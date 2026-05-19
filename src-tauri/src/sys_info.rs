use std::path::PathBuf;
use std::process::Command;

use serde::Serialize;

#[derive(Serialize)]
pub struct CliInfo {
    pub kind: String,
    pub found: bool,
    pub path: Option<String>,
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
    let program = if cfg!(windows) { "node.exe" } else { "node" };
    let mut cmd = Command::new(program);
    if let Some(dir) = cwd.as_deref() {
        cmd.current_dir(dir);
    }
    cmd.arg("--version");
    let out = cmd.output().ok()?;
    if !out.status.success() {
        return None;
    }
    let s = String::from_utf8(out.stdout).ok()?.trim().to_string();
    if s.is_empty() { None } else { Some(s) }
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
