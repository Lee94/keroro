use std::path::PathBuf;
use std::process::Command;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

use serde::Serialize;

// CreateProcess flag that suppresses the brief console window flash a GUI
// Tauri host gets every time it spawns a console subprocess. Without it,
// `node.exe --version` (called on boot + every project switch) pops a black
// box for a frame.
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Serialize)]
pub struct CliInfo {
    pub kind: String,
    pub found: bool,
    pub path: Option<String>,
}

#[derive(Serialize)]
pub struct GitStatus {
    pub branch: Option<String>,
    pub ahead: u32,
    pub behind: u32,
    pub additions: u32,
    pub deletions: u32,
    pub dirty: bool,
}

const CLI_BINARIES: &[(&str, &str)] = &[
    ("claude", "claude"),
    ("codex", "codex"),
    // ("gemini", "gemini"),
    // ("pi", "pi"),
];

// macOS .app bundles launched from Finder/Dock inherit a stripped PATH that
// misses Homebrew + user-local bin dirs, so probe these explicitly too.
fn extra_lookup_paths() -> Vec<PathBuf> {
    let home = std::env::var("HOME").ok().map(PathBuf::from);
    [
        home.as_ref().map(|h| h.join(".local/bin")),
        Some(PathBuf::from("/opt/homebrew/bin")),
        Some(PathBuf::from("/usr/local/bin")),
    ]
    .into_iter()
    .flatten()
    .collect()
}

pub fn find_cli(name: &str) -> Option<PathBuf> {
    if let Ok(p) = which::which(name) {
        return Some(p);
    }
    for dir in extra_lookup_paths() {
        let candidate = dir.join(name);
        if candidate.exists() {
            return Some(candidate);
        }
    }
    None
}

#[tauri::command]
pub fn detect_clis() -> Vec<CliInfo> {
    CLI_BINARIES
        .iter()
        .map(|(kind, bin)| {
            let path = find_cli(bin);
            CliInfo {
                kind: (*kind).to_string(),
                found: path.is_some(),
                path: path.map(|p| p.to_string_lossy().into_owned()),
            }
        })
        .collect()
}

#[tauri::command]
pub fn detect_node_version(cwd: Option<String>) -> Option<String> {
    // Finder-launched .apps have a stripped PATH that misses Homebrew/nvm
    // bin dirs, so resolve via find_cli rather than relying on PATH lookup.
    let program = find_cli(if cfg!(windows) { "node.exe" } else { "node" })?;
    let mut cmd = Command::new(program);
    if let Some(dir) = cwd.as_deref() {
        cmd.current_dir(dir);
    }
    cmd.arg("--version");
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    let out = cmd.output().ok()?;
    if !out.status.success() {
        return None;
    }
    let s = String::from_utf8(out.stdout).ok()?.trim().to_string();
    if s.is_empty() {
        None
    } else {
        Some(s)
    }
}

#[tauri::command]
pub fn detect_git_branch(cwd: String) -> Option<String> {
    let head = PathBuf::from(&cwd).join(".git").join("HEAD");
    let raw = std::fs::read_to_string(&head).ok()?;
    let trimmed = raw.trim();
    if let Some(rest) = trimmed.strip_prefix("ref: refs/heads/") {
        return Some(rest.to_string());
    }
    if let Some(rest) = trimmed.strip_prefix("ref: refs/") {
        return Some(rest.to_string());
    }
    if trimmed.len() >= 7 {
        return Some(trimmed[..7].to_string());
    }
    None
}

#[tauri::command]
pub fn detect_git_status(cwd: String) -> Result<Option<GitStatus>, String> {
    let mut cmd = Command::new(if cfg!(windows) { "git.exe" } else { "git" });
    cmd.current_dir(&cwd)
        .arg("--no-optional-locks")
        .arg("status")
        .arg("--porcelain=v1")
        .arg("--branch")
        .arg("--untracked-files=normal");
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let out = match cmd.output() {
        Ok(out) => out,
        Err(_) => return Ok(None),
    };
    if !out.status.success() {
        return Ok(None);
    }
    let stdout =
        String::from_utf8(out.stdout).map_err(|e| format!("解析 git status 输出失败: {e}"))?;
    let mut status = match parse_git_status(&stdout) {
        Some(status) => status,
        None => return Ok(None),
    };
    let line_changes = detect_git_line_changes(&cwd)?;
    status.additions = line_changes.0;
    status.deletions = line_changes.1;
    Ok(Some(status))
}

fn detect_git_line_changes(cwd: &str) -> Result<(u32, u32), String> {
    let mut cmd = Command::new(if cfg!(windows) { "git.exe" } else { "git" });
    cmd.current_dir(cwd)
        .arg("--no-optional-locks")
        .arg("diff")
        .arg("--numstat")
        .arg("HEAD")
        .arg("--");
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let out = match cmd.output() {
        Ok(out) => out,
        Err(_) => return Ok((0, 0)),
    };
    if !out.status.success() {
        return Ok((0, 0));
    }
    let stdout =
        String::from_utf8(out.stdout).map_err(|e| format!("解析 git diff 输出失败: {e}"))?;
    Ok(parse_git_numstat(&stdout))
}

fn parse_git_numstat(stdout: &str) -> (u32, u32) {
    let mut additions: u32 = 0;
    let mut deletions: u32 = 0;
    for line in stdout.lines() {
        let mut parts = line.split('\t');
        let added = parts.next().and_then(|s| s.parse::<u32>().ok());
        let deleted = parts.next().and_then(|s| s.parse::<u32>().ok());
        if let Some(n) = added {
            additions = additions.saturating_add(n);
        }
        if let Some(n) = deleted {
            deletions = deletions.saturating_add(n);
        }
    }
    (additions, deletions)
}

fn parse_git_status(stdout: &str) -> Option<GitStatus> {
    let mut branch = None;
    let mut ahead = 0;
    let mut behind = 0;
    let mut staged = 0;
    let mut unstaged = 0;
    let mut untracked = 0;

    for line in stdout.lines() {
        if let Some(rest) = line.strip_prefix("## ") {
            let parsed = parse_branch_status(rest);
            branch = parsed.0;
            ahead = parsed.1;
            behind = parsed.2;
            continue;
        }

        let bytes = line.as_bytes();
        let x = match bytes.first() {
            Some(b) => char::from(*b),
            None => ' ',
        };
        let y = match bytes.get(1) {
            Some(b) => char::from(*b),
            None => ' ',
        };
        if x == '?' && y == '?' {
            untracked += 1;
            continue;
        }
        if x == '!' && y == '!' {
            continue;
        }
        if x != ' ' && x != '?' && x != '!' {
            staged += 1;
        }
        if y != ' ' && y != '?' && y != '!' {
            unstaged += 1;
        }
    }

    let dirty = staged > 0 || unstaged > 0 || untracked > 0;
    if branch.is_none() && !dirty && ahead == 0 && behind == 0 {
        return None;
    }

    Some(GitStatus {
        branch,
        ahead,
        behind,
        additions: 0,
        deletions: 0,
        dirty,
    })
}

fn parse_branch_status(rest: &str) -> (Option<String>, u32, u32) {
    let mut ahead = 0;
    let mut behind = 0;

    if let Some(start) = rest.find('[') {
        if let Some(end) = rest[start + 1..].find(']') {
            let marker = &rest[start + 1..start + 1 + end];
            for part in marker.split(',') {
                let item = part.trim();
                if let Some(n) = item.strip_prefix("ahead ") {
                    if let Ok(value) = n.parse::<u32>() {
                        ahead = value;
                    }
                } else if let Some(n) = item.strip_prefix("behind ") {
                    if let Ok(value) = n.parse::<u32>() {
                        behind = value;
                    }
                }
            }
        }
    }

    let branch_part = match rest.split_once('[') {
        Some((head, _)) => head.trim(),
        None => rest.trim(),
    };
    let branch_name = if let Some(name) = branch_part.strip_prefix("No commits yet on ") {
        name
    } else if branch_part == "HEAD (no branch)" {
        "detached"
    } else {
        match branch_part.split_once("...") {
            Some((name, _)) => name.trim(),
            None => branch_part,
        }
    };

    let branch = if branch_name.is_empty() {
        None
    } else {
        Some(branch_name.to_string())
    };
    (branch, ahead, behind)
}
