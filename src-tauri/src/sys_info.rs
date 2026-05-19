use std::path::PathBuf;
use std::process::Command;

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
