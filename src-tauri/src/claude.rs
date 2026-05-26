use std::path::PathBuf;

use serde::Deserialize;
use tokio::io::AsyncBufReadExt;

// Claude Code encodes a project directory by replacing every path-syntax
// character (`/`, `\`, `:`, `.`) with `-`, then storing the session JSONL
// at ~/.claude/projects/<encoded>/<session-id>.jsonl.
//
// On Windows `std::fs::canonicalize` prepends `\\?\` (the extended-length
// prefix), which Claude Code does NOT include in its encoding — so we
// strip it back off before replacing characters. Without this strip the
// computed key for `D:\work\keroro` comes out as `----D--work-keroro`
// instead of `D--work-keroro`, every lookup misses, `claude_spawn_args`
// always falls back to `--session-id`, and the user ends up in a loop on
// `Error: Session ID … is already in use.`
fn encode_project_key(path: &std::path::Path) -> String {
    let canonical = std::fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    let mut s = canonical.to_string_lossy().into_owned();
    if let Some(stripped) = s.strip_prefix(r"\\?\") {
        s = stripped.to_string();
    }
    s.chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '.' => '-',
            _ => c,
        })
        .collect()
}

fn session_file_path(cwd: &str, session_id: &str) -> Option<PathBuf> {
    let home = std::env::var("HOME").ok().map(PathBuf::from)?;
    let key = encode_project_key(std::path::Path::new(cwd));
    Some(
        home.join(".claude")
            .join("projects")
            .join(key)
            .join(format!("{session_id}.jsonl")),
    )
}

#[tauri::command]
pub fn claude_spawn_args(session_id: String, cwd: Option<String>) -> Vec<String> {
    let resumable = cwd
        .as_deref()
        .and_then(|c| session_file_path(c, &session_id))
        .map(|p| p.exists())
        .unwrap_or(false);
    let flag = if resumable { "--resume" } else { "--session-id" };
    vec![flag.to_string(), session_id]
}

// First user-typed prompt in the session, used as the tab's auto title.
// Skips tool_result entries (those arrive as `content: [...]` arrays under
// the same `type=user` envelope) and slash-command XML wrappers so the
// title reflects what the user actually typed. Returns None until the user
// has sent at least one real message.
#[tauri::command]
pub async fn claude_session_title(session_id: String, cwd: Option<String>) -> Option<String> {
    let path = cwd.as_deref().and_then(|c| session_file_path(c, &session_id))?;
    // JSONL files grow over the lifetime of a session — async I/O so the 5 s
    // poll-per-tab loop doesn't hold a Tauri worker thread for the entire
    // open-read-scan cycle.
    let file = tokio::fs::File::open(path).await.ok()?;
    let reader = tokio::io::BufReader::new(file);
    let mut lines = reader.lines();
    while let Ok(Some(line)) = lines.next_line().await {
        if let Some(title) = extract_user_prompt_title(&line) {
            return Some(title);
        }
    }
    None
}

fn extract_user_prompt_title(line: &str) -> Option<String> {
    let v: serde_json::Value = serde_json::from_str(line).ok()?;
    if v.get("type")?.as_str()? != "user" {
        return None;
    }
    let msg = v.get("message")?;
    if msg.get("role")?.as_str()? != "user" {
        return None;
    }
    let text = msg.get("content")?.as_str()?;
    let cleaned = sanitize_prompt(text)?;
    Some(truncate_chars(&cleaned, 40))
}

fn sanitize_prompt(s: &str) -> Option<String> {
    let collapsed: String = s
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty())
        .collect::<Vec<_>>()
        .join(" ");
    let trimmed = collapsed.trim();
    if trimmed.is_empty() {
        return None;
    }
    // Slash-command expansions and other harness-injected prompts arrive
    // wrapped like `<command-message>…</command-message>` — not useful as a
    // tab title, skip them so the next real message wins.
    if trimmed.starts_with('<') {
        return None;
    }
    Some(trimmed.to_string())
}

fn truncate_chars(s: &str, cap: usize) -> String {
    let chars: Vec<char> = s.chars().collect();
    if chars.len() <= cap {
        s.to_string()
    } else {
        let head: String = chars[..cap].iter().collect();
        format!("{head}…")
    }
}

#[derive(Deserialize)]
struct ClaudeSessionRegistryEntry {
    pid: u32,
    #[serde(rename = "sessionId")]
    session_id: String,
}

// Best-effort unlock of a claude session whose registry entry refers to a
// dead pid. Claude tracks every running interactive process in
// `~/.claude/sessions/<pid>.json` and refuses to reuse a sessionId that
// still has a matching registry file (the `Error: Session ID <uuid> is
// already in use.` failure mode). Crashed / SIGKILL'd / pty_kill'd
// processes can leave these entries behind forever.
//
// Returns true iff we deleted at least one matching stale entry — i.e. the
// caller can now safely `--resume` the sessionId. Live processes are
// always left alone; if the registered pid is still running, this is a
// real conflict and the caller must rotate the id instead.
#[tauri::command]
pub async fn claude_unlock_session(session_id: String) -> Result<bool, String> {
    let home = std::env::var("HOME").map_err(|e| format!("HOME 未设置: {e}"))?;
    let dir = PathBuf::from(home).join(".claude").join("sessions");
    let mut entries = match tokio::fs::read_dir(&dir).await {
        Ok(e) => e,
        // No registry dir → nothing to unlock, that's a success-equivalent.
        Err(_) => return Ok(false),
    };
    let mut unlocked = false;
    while let Ok(Some(entry)) = entries.next_entry().await {
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) != Some("json") {
            continue;
        }
        let content = match tokio::fs::read_to_string(&path).await {
            Ok(c) => c,
            Err(_) => continue,
        };
        let info: ClaudeSessionRegistryEntry = match serde_json::from_str(&content) {
            Ok(i) => i,
            Err(_) => continue,
        };
        if info.session_id != session_id {
            continue;
        }
        if is_pid_alive(info.pid) {
            // Real running claude owns it — don't touch.
            continue;
        }
        if tokio::fs::remove_file(&path).await.is_ok() {
            unlocked = true;
        }
    }
    Ok(unlocked)
}

#[cfg(windows)]
fn is_pid_alive(pid: u32) -> bool {
    use std::ffi::c_void;
    extern "system" {
        fn OpenProcess(desired_access: u32, inherit: i32, pid: u32) -> *mut c_void;
        fn CloseHandle(handle: *mut c_void) -> i32;
        fn GetExitCodeProcess(handle: *mut c_void, exit_code: *mut u32) -> i32;
    }
    const PROCESS_QUERY_LIMITED_INFORMATION: u32 = 0x1000;
    const STILL_ACTIVE: u32 = 259;
    unsafe {
        let h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if h.is_null() {
            return false;
        }
        let mut code: u32 = 0;
        let ok = GetExitCodeProcess(h, &mut code);
        CloseHandle(h);
        ok != 0 && code == STILL_ACTIVE
    }
}

#[cfg(not(windows))]
fn is_pid_alive(pid: u32) -> bool {
    // No libc dep — shell out to `kill -0`, which probes existence without
    // delivering a signal. Status code: 0 = alive, anything else = dead /
    // permission denied. Conservative on error: treat as alive so we never
    // delete a registry entry we can't verify.
    std::process::Command::new("kill")
        .arg("-0")
        .arg(pid.to_string())
        .status()
        .map(|s| s.success())
        .unwrap_or(true)
}
