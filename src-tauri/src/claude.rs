use std::path::PathBuf;

// Claude Code encodes a project directory by replacing every `/` and `.` in
// the canonicalized absolute path with `-`, then storing it under
// ~/.claude/projects/<encoded>/<session-id>.jsonl.
fn encode_project_key(path: &std::path::Path) -> String {
    let canonical = std::fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    let s = canonical.to_string_lossy();
    s.chars()
        .map(|c| if c == '/' || c == '.' { '-' } else { c })
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
