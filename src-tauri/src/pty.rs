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
    if let Some(dir) = cwd {
        cmd.cwd(dir);
    } else if let Ok(home) = std::env::var(if cfg!(windows) { "USERPROFILE" } else { "HOME" }) {
        cmd.cwd(home);
    }
    cmd
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

    let cmd = pick_shell(cwd.as_deref());
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
