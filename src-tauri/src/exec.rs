use std::collections::HashMap;
use std::io::Read;
#[cfg(unix)]
use std::os::unix::process::CommandExt;
#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::process::{Child, Command, Stdio};

// CreateProcess flag that suppresses the console window flash a GUI Tauri
// host gets when spawning `cmd.exe /C ...`. Without it the shell command
// pops a black box for the duration of the run.
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};

// Cap captured output at 1 MiB so a runaway dev server (or `yes`) can't
// balloon RAM. When we hit the cap we keep the most recent bytes and prepend
// a one-time truncation marker on next read.
const OUTPUT_CAP: usize = 1024 * 1024;
const TRUNCATED_MARKER: &[u8] = b"\n[...output truncated, showing the most recent 1 MiB...]\n";

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum RunState {
    Idle,
    Running,
    Success,
    Failed,
    Killed,
}

struct RunHandle {
    // Wrapped in Option so the supervisor thread can `take()` ownership
    // before calling wait(). Kill paths lock briefly to call .kill() before
    // the take happens (it stays Some(_) until wait() begins).
    child: Mutex<Option<Child>>,
    output: Mutex<Vec<u8>>,
    truncated: AtomicBool,
    killed_requested: AtomicBool,
    state: Mutex<RunState>,
    exit_code: Mutex<Option<i32>>,
    started_at: u64,
    finished_at: Mutex<Option<u64>>,
}

impl RunHandle {
    fn new() -> Self {
        Self {
            child: Mutex::new(None),
            output: Mutex::new(Vec::new()),
            truncated: AtomicBool::new(false),
            killed_requested: AtomicBool::new(false),
            state: Mutex::new(RunState::Running),
            exit_code: Mutex::new(None),
            started_at: now_secs(),
            finished_at: Mutex::new(None),
        }
    }
}

pub struct ExecManager {
    runs: Mutex<HashMap<String, Arc<RunHandle>>>,
}

impl ExecManager {
    pub fn new() -> Self {
        Self { runs: Mutex::new(HashMap::new()) }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct CommandSnapshot {
    #[serde(rename = "commandId")]
    pub command_id: String,
    pub state: RunState,
    #[serde(rename = "exitCode")]
    pub exit_code: Option<i32>,
    #[serde(rename = "startedAt")]
    pub started_at: Option<u64>,
    #[serde(rename = "finishedAt")]
    pub finished_at: Option<u64>,
    pub output: String,
}

#[derive(Debug, Clone, Serialize)]
struct StatusEvent {
    #[serde(rename = "commandId")]
    command_id: String,
    state: RunState,
    #[serde(rename = "exitCode")]
    exit_code: Option<i32>,
    #[serde(rename = "startedAt")]
    started_at: Option<u64>,
    #[serde(rename = "finishedAt")]
    finished_at: Option<u64>,
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn build_shell_command(command: &str) -> Command {
    #[cfg(not(windows))]
    {
        let program = pick_shell_program();
        let mut cmd = Command::new(program);
        // Login shell so PATH from .zshrc / .profile is loaded (same reason
        // pty.rs uses `-l`). Without this a .app launched from Finder sees a
        // stripped env and `npm` / `node` may not be on PATH.
        cmd.arg("-l");
        cmd.arg("-c");
        cmd.arg(command);
        apply_piped_env(&mut cmd);
        // Run the shell in its own process group so `killpg` can take down
        // the whole tree (zsh + the user's `pnpm dev` + its node children).
        // Without this, `child.kill()` only kills zsh and the actual workload
        // gets reparented to launchd and keeps running.
        cmd.process_group(0);
        cmd
    }
    #[cfg(windows)]
    {
        // Share the terminal pane's shell pick (pwsh → powershell → cmd.exe)
        // so commands run with the same PATH/aliases the user has in the
        // built-in terminal. PowerShell variants need `-Command`; cmd needs `/C`.
        let program = crate::pty::pick_program();
        let basename = std::path::Path::new(&program)
            .file_name()
            .and_then(|s| s.to_str())
            .map(|s| s.to_ascii_lowercase())
            .unwrap_or_default();
        let is_powershell = basename.starts_with("pwsh") || basename.starts_with("powershell");
        let mut cmd = Command::new(&program);
        if is_powershell {
            // -NoLogo to suppress the banner; we deliberately do NOT pass
            // -NoProfile so $PROFILE runs and the user's PATH/aliases match
            // what they get in the terminal pane. Profile cost (~300-700ms)
            // is the tradeoff documented to the user.
            cmd.arg("-NoLogo");
            cmd.arg("-Command");
            cmd.arg(command);
        } else {
            cmd.arg("/C");
            cmd.arg(command);
        }
        apply_piped_env(&mut cmd);
        cmd.creation_flags(CREATE_NO_WINDOW);
        cmd
    }
}

// Env for piped (non-TTY) command runs surfaced in the output modal.
// Differs from pty::apply_terminal_env in one important way: we force
// TERM=dumb here so tools like pnpm/vite don't emit ANSI color escapes
// that would render as `[32m…` garbage in the <pre>. LANG is still kept
// at UTF-8 so CJK paths and output decode cleanly.
fn apply_piped_env(cmd: &mut Command) {
    cmd.env("TERM", "dumb");
    cmd.env("NO_COLOR", "1");
    #[cfg(not(windows))]
    {
        let has_utf8_locale = ["LC_ALL", "LC_CTYPE", "LANG"].iter().any(|k| {
            std::env::var(k)
                .map(|v| {
                    let u = v.to_ascii_uppercase();
                    u.contains("UTF-8") || u.contains("UTF8")
                })
                .unwrap_or(false)
        });
        if !has_utf8_locale {
            cmd.env("LANG", "en_US.UTF-8");
            cmd.env("LC_CTYPE", "en_US.UTF-8");
        }
    }
}

// Strip ANSI escape sequences (CSI, OSC) and stray control bytes that a
// program forced through `NO_COLOR=1`/`TERM=dumb` may still emit (e.g.
// progress redraws via `\r` + cursor moves). Keeps `\n`, `\t`, `\r` since
// those render fine in <pre>. Operates on whole accumulated bytes, so
// mid-sequence chunk boundaries are not a concern by call time.
fn strip_ansi(input: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(input.len());
    let mut i = 0;
    while i < input.len() {
        let b = input[i];
        if b == 0x1b {
            if i + 1 >= input.len() {
                break;
            }
            let nx = input[i + 1];
            if nx == b'[' {
                // CSI: ESC [ … final-byte (0x40..=0x7e)
                let mut j = i + 2;
                while j < input.len() && !(0x40..=0x7e).contains(&input[j]) {
                    j += 1;
                }
                i = j.saturating_add(1);
                continue;
            }
            if nx == b']' {
                // OSC: ESC ] … BEL or ESC \
                let mut j = i + 2;
                while j < input.len() {
                    if input[j] == 0x07 {
                        j += 1;
                        break;
                    }
                    if input[j] == 0x1b && j + 1 < input.len() && input[j + 1] == b'\\' {
                        j += 2;
                        break;
                    }
                    j += 1;
                }
                i = j;
                continue;
            }
            // Other two-byte escapes (e.g. ESC =, ESC >, ESC c)
            i += 2;
            continue;
        }
        // Drop bare control bytes other than the common rendering ones.
        if b < 0x20 && b != b'\n' && b != b'\t' && b != b'\r' {
            i += 1;
            continue;
        }
        out.push(b);
        i += 1;
    }
    out
}

#[cfg(not(windows))]
fn pick_shell_program() -> String {
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

fn append_output(handle: &RunHandle, chunk: &[u8]) {
    let mut buf = handle.output.lock().unwrap();
    buf.extend_from_slice(chunk);
    if buf.len() > OUTPUT_CAP {
        // Trim to last OUTPUT_CAP bytes. First overflow stamps the marker.
        let excess = buf.len() - OUTPUT_CAP;
        buf.drain(..excess);
        if !handle.truncated.swap(true, Ordering::Relaxed) {
            // Insert marker at the start so the user knows the prefix is gone.
            let mut prefixed = Vec::with_capacity(TRUNCATED_MARKER.len() + buf.len());
            prefixed.extend_from_slice(TRUNCATED_MARKER);
            prefixed.extend_from_slice(&buf);
            *buf = prefixed;
        }
    }
}

fn spawn_reader<R: Read + Send + 'static>(mut reader: R, handle: Arc<RunHandle>) -> thread::JoinHandle<()> {
    thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => append_output(&handle, &buf[..n]),
                Err(_) => break,
            }
        }
    })
}

fn emit_status(app: &AppHandle, command_id: &str, handle: &RunHandle) {
    let state = *handle.state.lock().unwrap();
    let exit_code = *handle.exit_code.lock().unwrap();
    let finished_at = *handle.finished_at.lock().unwrap();
    let _ = app.emit(
        "command://status",
        StatusEvent {
            command_id: command_id.to_string(),
            state,
            exit_code,
            started_at: Some(handle.started_at),
            finished_at,
        },
    );
}

fn kill_handle_blocking(handle: &RunHandle) {
    handle.killed_requested.store(true, Ordering::Relaxed);
    let mut guard = handle.child.lock().unwrap();
    let Some(child) = guard.as_mut() else { return };

    #[cfg(unix)]
    {
        // We spawned the shell in its own process group (pgid == shell pid),
        // so signaling the negative pid hits every descendant — that's how
        // we take down zsh's `pnpm dev` + node grandchildren together.
        let pgid = child.id() as i32;
        unsafe {
            // SIGTERM first so cleanup handlers (file unlocks, port releases)
            // get a chance to run.
            libc::killpg(pgid, libc::SIGTERM);
        }
        // Give the group a brief window to exit cleanly before escalating.
        // The supervisor thread that wait()s the child is still running, so
        // we just sleep a bit here rather than introducing a second wait path.
        thread::sleep(std::time::Duration::from_millis(250));
        unsafe {
            libc::killpg(pgid, libc::SIGKILL);
        }
        // Also belt-and-braces SIGKILL the direct child in case it somehow
        // detached from the group.
        let _ = child.kill();
    }
    #[cfg(windows)]
    {
        // The spawned child here is the wrapper shell (powershell.exe /
        // cmd.exe). The user's actual command runs as a grandchild that
        // inherited our stdout/stderr pipe handles. `child.kill()` alone only
        // terminates the wrapper — reparented grandchildren keep the pipes
        // open, the reader threads never see EOF, and the supervisor never
        // flips state out of Running (so the Stop button looks dead). Use
        // `taskkill /F /T` to take down the whole tree so the pipes close and
        // the supervisor can reap.
        let pid = child.id();
        let _ = Command::new("taskkill")
            .args(["/F", "/T", "/PID", &pid.to_string()])
            .creation_flags(CREATE_NO_WINDOW)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
        // Fallback in case taskkill is unavailable or the tree took itself
        // down already — harmless if the child is already gone.
        let _ = child.kill();
    }
    #[cfg(all(not(unix), not(windows)))]
    {
        let _ = child.kill();
    }
}

#[tauri::command]
pub fn command_run(
    app: AppHandle,
    mgr: State<'_, ExecManager>,
    command_id: String,
    command: String,
    cwd: String,
) -> Result<(), String> {
    if command.trim().is_empty() {
        return Err("command is empty".to_string());
    }

    // If the same command id is currently running, kill it first so a new run
    // cleanly replaces the previous attempt. (Frontend left-click already
    // guards against this, but Re-run from the output modal needs it.)
    if let Some(existing) = mgr.runs.lock().map_err(|e| e.to_string())?.get(&command_id).cloned() {
        let still_running = matches!(*existing.state.lock().unwrap(), RunState::Running);
        if still_running {
            kill_handle_blocking(&existing);
            // Best-effort: wait briefly so the previous child is reaped before
            // we emit a new Running state. We don't block forever; the OS will
            // clean up if the child is stuck.
            for _ in 0..20 {
                if !matches!(*existing.state.lock().unwrap(), RunState::Running) {
                    break;
                }
                thread::sleep(std::time::Duration::from_millis(25));
            }
        }
    }

    let mut cmd = build_shell_command(&command);
    cmd.current_dir(&cwd);
    cmd.stdin(Stdio::null());
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("spawn failed: {e}"))?;
    let stdout = child.stdout.take().ok_or_else(|| "no stdout".to_string())?;
    let stderr = child.stderr.take().ok_or_else(|| "no stderr".to_string())?;

    let handle = Arc::new(RunHandle::new());
    *handle.child.lock().unwrap() = Some(child);
    mgr.runs
        .lock()
        .map_err(|e| e.to_string())?
        .insert(command_id.clone(), handle.clone());

    emit_status(&app, &command_id, &handle);

    let stdout_thread = spawn_reader(stdout, handle.clone());
    let stderr_thread = spawn_reader(stderr, handle.clone());

    let app_clone = app.clone();
    let id_clone = command_id.clone();
    let handle_clone = handle.clone();
    thread::spawn(move || {
        // Readers exit when the OS closes the pipes, which happens when the
        // child exits — so once both join, we know the child is reaped-ready.
        let _ = stdout_thread.join();
        let _ = stderr_thread.join();
        let exit = {
            let mut guard = handle_clone.child.lock().unwrap();
            match guard.take() {
                Some(mut child) => child.wait().ok(),
                None => None,
            }
        };
        let (state, exit_code) = match exit {
            Some(status) => {
                let code = status.code();
                if handle_clone.killed_requested.load(Ordering::Relaxed) {
                    (RunState::Killed, code)
                } else if status.success() {
                    (RunState::Success, code)
                } else {
                    (RunState::Failed, code)
                }
            }
            None => (
                if handle_clone.killed_requested.load(Ordering::Relaxed) {
                    RunState::Killed
                } else {
                    RunState::Failed
                },
                None,
            ),
        };
        *handle_clone.state.lock().unwrap() = state;
        *handle_clone.exit_code.lock().unwrap() = exit_code;
        *handle_clone.finished_at.lock().unwrap() = Some(now_secs());
        emit_status(&app_clone, &id_clone, &handle_clone);
    });

    Ok(())
}

#[tauri::command]
pub fn command_kill(
    mgr: State<'_, ExecManager>,
    command_id: String,
) -> Result<(), String> {
    let handle = {
        let map = mgr.runs.lock().map_err(|e| e.to_string())?;
        map.get(&command_id).cloned()
    };
    if let Some(h) = handle {
        kill_handle_blocking(&h);
    }
    Ok(())
}

#[tauri::command]
pub fn command_output(
    mgr: State<'_, ExecManager>,
    command_id: String,
) -> Result<CommandSnapshot, String> {
    let handle = {
        let map = mgr.runs.lock().map_err(|e| e.to_string())?;
        map.get(&command_id).cloned()
    };
    match handle {
        Some(h) => {
            let output = {
                let buf = h.output.lock().unwrap();
                let cleaned = strip_ansi(&buf);
                String::from_utf8_lossy(&cleaned).into_owned()
            };
            Ok(CommandSnapshot {
                command_id,
                state: *h.state.lock().unwrap(),
                exit_code: *h.exit_code.lock().unwrap(),
                started_at: Some(h.started_at),
                finished_at: *h.finished_at.lock().unwrap(),
                output,
            })
        }
        None => Ok(CommandSnapshot {
            command_id,
            state: RunState::Idle,
            exit_code: None,
            started_at: None,
            finished_at: None,
            output: String::new(),
        }),
    }
}
