use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::SystemTime;

use serde::Serialize;
use tokio::process::Command;

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

// ─── Helpers ─────────────────────────────────────────────────────────

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

// Build a `tokio::process::Command` with the windows-only no-window flag
// applied. All subprocess spawns funnel through here so we never accidentally
// flash a console window — and so any future shared flags only need to be set
// in one place.
fn cmd(program: &str) -> Command {
    let mut c = Command::new(program);
    #[cfg(windows)]
    c.creation_flags(CREATE_NO_WINDOW);
    c
}

fn git_program() -> &'static str {
    if cfg!(windows) { "git.exe" } else { "git" }
}

// Shared async git invocation. Returns Ok(stdout_string) on success, Err on
// non-zero exit or spawn failure.
async fn run_git_capture(cwd: &str, args: &[&str]) -> Result<String, String> {
    let mut c = cmd(git_program());
    c.current_dir(cwd);
    for a in args {
        c.arg(a);
    }
    let out = c
        .output()
        .await
        .map_err(|e| format!("git 调用失败: {e}"))?;
    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr).into_owned();
        return Err(format!(
            "git {:?} 退出 {:?}: {}",
            args,
            out.status.code(),
            stderr.trim()
        ));
    }
    String::from_utf8(out.stdout).map_err(|e| format!("解析 git 输出失败: {e}"))
}

// ─── CLI / Node detection ────────────────────────────────────────────

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
pub async fn detect_node_version(cwd: Option<String>) -> Option<String> {
    // Finder-launched .apps have a stripped PATH that misses Homebrew/nvm
    // bin dirs, so resolve via find_cli rather than relying on PATH lookup.
    let program = find_cli(if cfg!(windows) { "node.exe" } else { "node" })?;
    let mut c = cmd(program.to_str()?);
    if let Some(dir) = cwd.as_deref() {
        c.current_dir(dir);
    }
    c.arg("--version");
    let out = c.output().await.ok()?;
    if !out.status.success() {
        return None;
    }
    let s = String::from_utf8(out.stdout).ok()?.trim().to_string();
    if s.is_empty() { None } else { Some(s) }
}

// ─── Git: branch / status / line counts ──────────────────────────────

#[tauri::command]
pub async fn detect_git_branch(cwd: String) -> Option<String> {
    let head = PathBuf::from(&cwd).join(".git").join("HEAD");
    let raw = tokio::fs::read_to_string(&head).await.ok()?;
    parse_git_head(&raw)
}

fn parse_git_head(raw: &str) -> Option<String> {
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
pub async fn detect_git_status(cwd: String) -> Result<Option<GitStatus>, String> {
    // Two cheap git invocations + one filesystem fan-out, all independent —
    // run them concurrently so the chip update (polled every 5s) finishes in
    // ~max(t1, t2, t3) instead of t1 + t2 + t3.
    let status_fut = run_git_capture(
        &cwd,
        &[
            "--no-optional-locks",
            "status",
            "--porcelain=v1",
            "--branch",
            "--untracked-files=normal",
        ],
    );
    let lines_fut = detect_git_line_changes(&cwd);
    let (status_res, line_changes) = tokio::join!(status_fut, lines_fut);

    let stdout = match status_res {
        Ok(s) => s,
        // `git status` failure (no repo, permission, etc.) is non-fatal — the
        // chip just hides.
        Err(_) => return Ok(None),
    };
    let mut status = match parse_git_status(&stdout) {
        Some(status) => status,
        None => return Ok(None),
    };
    let (adds, dels) = line_changes?;
    status.additions = adds;
    status.deletions = dels;
    Ok(Some(status))
}

#[derive(Serialize)]
pub struct GitBranchInfo {
    pub current: Option<String>,
    pub locals: Vec<String>,
}

#[tauri::command]
pub async fn list_git_branches(cwd: String) -> Result<GitBranchInfo, String> {
    // `for-each-ref` is cheap and stable; we ask for short names only and let
    // git sort by last commit date so the most recently touched branches sit
    // at the top of the menu. Run the branch-list and HEAD-read concurrently
    // because they're independent — HEAD is a tiny file but on a cold cache
    // the parallelism still shaves a few ms.
    let list_fut = run_git_capture(
        &cwd,
        &[
            "--no-optional-locks",
            "for-each-ref",
            "--sort=-committerdate",
            "--format=%(refname:short)",
            "refs/heads/",
        ],
    );
    let current_fut = detect_git_branch(cwd.clone());
    let (list_res, current) = tokio::join!(list_fut, current_fut);
    let stdout = list_res?;
    let locals: Vec<String> = stdout
        .lines()
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty())
        .collect();
    Ok(GitBranchInfo { current, locals })
}

#[tauri::command]
pub async fn checkout_git_branch(cwd: String, branch: String) -> Result<(), String> {
    if branch.trim().is_empty() {
        return Err("分支名为空".to_string());
    }
    let mut c = cmd(git_program());
    c.current_dir(&cwd).arg("checkout").arg(&branch);
    let out = c
        .output()
        .await
        .map_err(|e| format!("git checkout 失败: {e}"))?;
    if !out.status.success() {
        // git surfaces "would be overwritten by checkout" / "did not match any
        // file" errors on stderr — pass them straight through so the user sees
        // the actual reason in the menu's error row.
        let stderr = String::from_utf8_lossy(&out.stderr).into_owned();
        let stderr = stderr.trim();
        let stdout = String::from_utf8_lossy(&out.stdout).into_owned();
        let stdout = stdout.trim();
        let msg = if !stderr.is_empty() {
            stderr.to_string()
        } else if !stdout.is_empty() {
            stdout.to_string()
        } else {
            format!("git checkout 退出 {:?}", out.status.code())
        };
        return Err(msg);
    }
    Ok(())
}

// ─── Git diff (panel) + untracked synthesis ─────────────────────────

#[tauri::command]
pub async fn git_diff(cwd: String) -> Result<String, String> {
    // `git diff HEAD` covers both staged + unstaged changes against the last
    // commit. Untracked files don't appear there (mirrors `git status`
    // semantics), so we list them separately and synthesize "new file"
    // entries below — otherwise brand-new files would silently disappear from
    // the diff panel even though the user clearly considers them changes.
    //
    // Both git invocations are independent — run them concurrently so we wait
    // ~max(t_diff, t_lsfiles) instead of the sum.
    let tracked_fut = run_git_capture(
        &cwd,
        &[
            "--no-optional-locks",
            "-c",
            "core.quotepath=false",
            // Override any user-configured `diff.external` (delta, difftastic, …)
            // so we always receive standard unified-diff output that our parser
            // understands. Without this, repos whose global config sets an
            // external diff tool get an unparseable per-file format — or worse,
            // a "fatal: external diff died" mid-stream truncation.
            "-c",
            "diff.external=",
            "diff",
            "HEAD",
            "--no-color",
            "--no-ext-diff",
        ],
    );
    let untracked_fut = run_git_capture(
        &cwd,
        &[
            "--no-optional-locks",
            "-c",
            "core.quotepath=false",
            "ls-files",
            "--others",
            "--exclude-standard",
        ],
    );
    let (tracked_res, untracked_res) = tokio::join!(tracked_fut, untracked_fut);
    let tracked = tracked_res?;
    let untracked_list = untracked_res.unwrap_or_default();

    // Read every untracked file concurrently (each `synthesize_added_diff` is
    // I/O bound). For a repo with N untracked files this turns N sequential
    // reads into one parallel batch — the difference is night-and-day on
    // slow disks / when Defender scans each read.
    let cwd_owned = cwd.clone();
    let handles: Vec<_> = untracked_list
        .lines()
        .filter(|l| !l.is_empty())
        .map(|rel| {
            let cwd = cwd_owned.clone();
            let rel = rel.to_string();
            tokio::spawn(async move { synthesize_added_diff(&cwd, &rel).await })
        })
        .collect();

    let mut out = tracked;
    for h in handles {
        if let Ok(Some(entry)) = h.await {
            out.push_str(&entry);
        }
    }
    Ok(out)
}

// Size cap mirrored across synthesize + line-counting paths. Anything larger
// than this is treated as binary-or-too-large to avoid a single rogue file
// stalling the panel / 5 s status poll.
const MAX_UNTRACKED_INLINE_BYTES: u64 = 256 * 1024;

// Build the same diff text git would emit for a brand-new file: a "new file"
// header plus a single hunk that adds every line of the file. We do this by
// hand (instead of shelling out to `git diff --no-index`) so the file appears
// in the same output stream as the tracked diff and our existing parser sees
// it as one more `diff --git …` section.
async fn synthesize_added_diff(cwd: &str, rel_path: &str) -> Option<String> {
    let full = PathBuf::from(cwd).join(rel_path);
    let meta = tokio::fs::metadata(&full).await.ok()?;
    if !meta.is_file() {
        return None;
    }
    if meta.len() > MAX_UNTRACKED_INLINE_BYTES {
        return Some(format!(
            "diff --git a/{p} b/{p}\nnew file mode 100644\nBinary files /dev/null and b/{p} differ\n",
            p = rel_path
        ));
    }

    let content = tokio::fs::read(&full).await.ok()?;

    // Binary detection mirrors git's own heuristic: a NUL byte in the first
    // ~8 KiB is treated as binary. We surface a one-liner instead of dumping
    // raw bytes — keeps the UI useful and avoids polluting the diff stream.
    let head = &content[..content.len().min(8000)];
    if head.contains(&0u8) {
        return Some(format!(
            "diff --git a/{p} b/{p}\nnew file mode 100644\nBinary files /dev/null and b/{p} differ\n",
            p = rel_path
        ));
    }

    let text = match std::str::from_utf8(&content) {
        Ok(s) => s.to_string(),
        Err(_) => String::from_utf8_lossy(&content).into_owned(),
    };

    let mut out = String::new();
    out.push_str(&format!("diff --git a/{p} b/{p}\n", p = rel_path));
    out.push_str("new file mode 100644\n");
    out.push_str("--- /dev/null\n");
    out.push_str(&format!("+++ b/{p}\n", p = rel_path));

    if text.is_empty() {
        return Some(out);
    }

    let ends_with_newline = text.ends_with('\n');
    let lines: Vec<&str> = text.split('\n').collect();
    let line_slice: &[&str] = if ends_with_newline && lines.last() == Some(&"") {
        &lines[..lines.len() - 1]
    } else {
        &lines[..]
    };
    let n = line_slice.len();
    out.push_str(&format!("@@ -0,0 +1,{n} @@\n"));
    for line in line_slice {
        out.push('+');
        out.push_str(line);
        out.push('\n');
    }
    if !ends_with_newline {
        out.push_str("\\ No newline at end of file\n");
    }
    Some(out)
}

// ─── Untracked line counting (chip totals) + cache ──────────────────

// Cached line counts for untracked files, keyed by absolute path. The 5 s
// status poll re-runs against the same files over and over; without a cache
// we'd re-read every untracked file each tick, which is the dominant cost on
// repos that keep large editor scratch files or local build artifacts
// outside `.gitignore`. mtime + size is sufficient to detect changes — a
// file that's been overwritten flips at least one of them.
#[derive(Clone, Copy)]
struct LineCountEntry {
    mtime: SystemTime,
    size: u64,
    lines: u32,
}

fn line_count_cache() -> &'static Mutex<HashMap<PathBuf, LineCountEntry>> {
    static CACHE: OnceLock<Mutex<HashMap<PathBuf, LineCountEntry>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn cache_lookup(path: &Path, mtime: SystemTime, size: u64) -> Option<u32> {
    let cache = line_count_cache().lock().ok()?;
    let entry = cache.get(path)?;
    if entry.mtime == mtime && entry.size == size {
        Some(entry.lines)
    } else {
        None
    }
}

fn cache_store(path: PathBuf, mtime: SystemTime, size: u64, lines: u32) {
    if let Ok(mut cache) = line_count_cache().lock() {
        cache.insert(path, LineCountEntry { mtime, size, lines });
    }
}

// Number of lines an untracked file would contribute as additions in the
// synthesized diff. Mirrors `synthesize_added_diff`'s eligibility rules so
// chip totals == panel totals: 0 for non-files, files larger than the inline
// cap, and binary content.
async fn count_untracked_lines(cwd: &str, rel_path: &str) -> u32 {
    let full = PathBuf::from(cwd).join(rel_path);
    let Ok(meta) = tokio::fs::metadata(&full).await else {
        return 0;
    };
    if !meta.is_file() {
        return 0;
    }
    let size = meta.len();
    if size > MAX_UNTRACKED_INLINE_BYTES {
        return 0;
    }
    let mtime = meta.modified().unwrap_or(SystemTime::UNIX_EPOCH);

    if let Some(cached) = cache_lookup(&full, mtime, size) {
        return cached;
    }

    let Ok(content) = tokio::fs::read(&full).await else {
        return 0;
    };
    let head = &content[..content.len().min(8000)];
    if head.contains(&0u8) {
        // Cache the zero so re-polling doesn't re-read binary files.
        cache_store(full, mtime, size, 0);
        return 0;
    }
    let mut count: u32 = 0;
    let mut has_trailing = false;
    for b in &content {
        if *b == b'\n' {
            count = count.saturating_add(1);
            has_trailing = false;
        } else {
            has_trailing = true;
        }
    }
    if has_trailing {
        count = count.saturating_add(1);
    }
    cache_store(full, mtime, size, count);
    count
}

async fn detect_git_line_changes(cwd: &str) -> Result<(u32, u32), String> {
    // Tracked numstat + untracked list run in parallel; the per-file line
    // counts then run in parallel too (each is an async fs::read that may
    // hit the cache).
    let numstat_fut = run_git_capture(
        cwd,
        &[
            "--no-optional-locks",
            "-c",
            "diff.external=",
            "diff",
            "--no-ext-diff",
            "--numstat",
            "HEAD",
            "--",
        ],
    );
    let untracked_fut = run_git_capture(
        cwd,
        &[
            "--no-optional-locks",
            "-c",
            "core.quotepath=false",
            "ls-files",
            "--others",
            "--exclude-standard",
        ],
    );
    let (numstat_res, untracked_res) = tokio::join!(numstat_fut, untracked_fut);

    // numstat failure is non-fatal — treat as zero changes so the chip still
    // shows ahead/behind / dirty state without blowing up the whole poll.
    let (mut adds, dels) = match numstat_res {
        Ok(s) => parse_git_numstat(&s),
        Err(_) => (0, 0),
    };
    let untracked = untracked_res.unwrap_or_default();

    let cwd_owned = cwd.to_string();
    let handles: Vec<_> = untracked
        .lines()
        .filter(|l| !l.is_empty())
        .map(|rel| {
            let cwd = cwd_owned.clone();
            let rel = rel.to_string();
            tokio::spawn(async move { count_untracked_lines(&cwd, &rel).await })
        })
        .collect();
    for h in handles {
        if let Ok(n) = h.await {
            adds = adds.saturating_add(n);
        }
    }
    Ok((adds, dels))
}

// ─── Pure parsers (sync, no I/O) ─────────────────────────────────────

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
