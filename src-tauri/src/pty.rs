use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Mutex;
use std::thread;

use base64::Engine;
use portable_pty::{Child, CommandBuilder, MasterPty, PtySize, native_pty_system};
use tauri::{AppHandle, Emitter, State};

struct PtySession {
    writer: Box<dyn Write + Send>,
    master: Box<dyn MasterPty + Send>,
    child: Box<dyn Child + Send + Sync>,
}

pub struct PtyManager {
    inner: Mutex<HashMap<String, PtySession>>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self { inner: Mutex::new(HashMap::new()) }
    }
}

fn pick_shell(cwd: Option<&str>) -> CommandBuilder {
    let program = pick_program();
    let mut cmd = CommandBuilder::new(program);
    apply_cwd(&mut cmd, cwd);
    cmd
}

fn apply_cwd(cmd: &mut CommandBuilder, cwd: Option<&str>) {
    if let Some(dir) = cwd {
        cmd.cwd(dir);
    } else if let Ok(home) = std::env::var(if cfg!(windows) { "USERPROFILE" } else { "HOME" }) {
        cmd.cwd(home);
    }
}

// POSIX-shell single-quote escape: wraps the input in '...' and replaces any
// embedded single quote with '\''. Needed because we pass the resolved binary
// path to `zsh -c`, and zsh splits the argument on whitespace.
#[cfg(not(windows))]
fn shell_quote(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    out.push('\'');
    for c in s.chars() {
        if c == '\'' {
            out.push_str("'\\''");
        } else {
            out.push(c);
        }
    }
    out.push('\'');
    out
}

// Build a PTY command that runs `command` (an absolute path or a name on PATH)
// with the given extra args. On Unix we wrap in a login shell so the user's
// PATH/init files are loaded — otherwise a .app launched from Finder inherits
// a stripped env and the CLI's own dependencies (node, etc.) may not be found.
fn run_command(command: &str, args: &[String], cwd: Option<&str>) -> CommandBuilder {
    let resolved = crate::sys_info::find_cli(command)
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_else(|| command.to_string());

    #[cfg(not(windows))]
    {
        let mut shell_cmd = format!("exec {}", shell_quote(&resolved));
        for a in args {
            shell_cmd.push(' ');
            shell_cmd.push_str(&shell_quote(a));
        }
        let mut cmd = CommandBuilder::new(pick_program());
        cmd.arg("-l");
        cmd.arg("-c");
        cmd.arg(shell_cmd);
        apply_cwd(&mut cmd, cwd);
        cmd
    }
    #[cfg(windows)]
    {
        let mut cmd = CommandBuilder::new(resolved);
        for a in args {
            cmd.arg(a);
        }
        apply_cwd(&mut cmd, cwd);
        cmd
    }
}

#[cfg(windows)]
fn pick_program() -> String {
    which::which("pwsh")
        .ok()
        .or_else(|| which::which("powershell").ok())
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_else(|| "cmd.exe".to_string())
}

#[cfg(not(windows))]
fn pick_program() -> String {
    if let Ok(shell) = std::env::var("SHELL") {
        if !shell.is_empty() {
            return shell;
        }
    }
    for candidate in ["/bin/zsh", "/bin/bash", "/bin/sh"] {
        if std::path::Path::new(candidate).exists() {
            return candidate.to_string();
        }
    }
    "/bin/sh".to_string()
}

#[tauri::command]
pub fn pty_spawn(
    app: AppHandle,
    state: State<'_, PtyManager>,
    id: String,
    cols: u16,
    rows: u16,
    cwd: Option<String>,
    command: Option<String>,
    args: Option<Vec<String>>,
) -> Result<(), String> {
    {
        let map = state.inner.lock().map_err(|e| e.to_string())?;
        if map.contains_key(&id) {
            return Ok(());
        }
    }

    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })
        .map_err(|e| e.to_string())?;

    let cmd = match command.as_deref() {
        Some(c) if !c.is_empty() => {
            let args = args.unwrap_or_default();
            run_command(c, &args, cwd.as_deref())
        }
        _ => pick_shell(cwd.as_deref()),
    };
    let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    drop(pair.slave);

    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;

    {
        let mut map = state.inner.lock().map_err(|e| e.to_string())?;
        map.insert(id.clone(), PtySession { writer, master: pair.master, child });
    }

    let data_event = format!("pty://data/{}", id);
    let exit_event = format!("pty://exit/{}", id);
    let app_for_thread = app.clone();
    thread::spawn(move || {
        let engine = base64::engine::general_purpose::STANDARD;
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let payload = engine.encode(&buf[..n]);
                    let _ = app_for_thread.emit(&data_event, payload);
                }
                Err(_) => break,
            }
        }
        let _ = app_for_thread.emit(&exit_event, ());
    });

    Ok(())
}

#[tauri::command]
pub fn pty_write(
    state: State<'_, PtyManager>,
    id: String,
    data: String,
) -> Result<(), String> {
    let mut map = state.inner.lock().map_err(|e| e.to_string())?;
    let session = map.get_mut(&id).ok_or_else(|| format!("no pty session {}", id))?;
    session.writer.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
    session.writer.flush().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn pty_resize(
    state: State<'_, PtyManager>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let map = state.inner.lock().map_err(|e| e.to_string())?;
    let session = map.get(&id).ok_or_else(|| format!("no pty session {}", id))?;
    session
        .master
        .resize(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn pty_kill(state: State<'_, PtyManager>, id: String) -> Result<(), String> {
    let mut map = state.inner.lock().map_err(|e| e.to_string())?;
    if let Some(mut session) = map.remove(&id) {
        let _ = session.child.kill();
        let _ = session.child.wait();
    }
    Ok(())
}
