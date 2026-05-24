use std::collections::HashMap;
use std::sync::Mutex;

use serde::Serialize;
use sysinfo::{Pid, ProcessesToUpdate, System};
use tauri::State;

fn build_process_tree(sys: &System, root: Pid) -> Vec<Pid> {
    let mut children: HashMap<Pid, Vec<Pid>> = HashMap::new();
    for (pid, p) in sys.processes() {
        if let Some(parent) = p.parent() {
            children.entry(parent).or_default().push(*pid);
        }
    }
    let mut stack = vec![root];
    let mut out = Vec::new();
    while let Some(pid) = stack.pop() {
        out.push(pid);
        if let Some(kids) = children.get(&pid) {
            stack.extend(kids.iter().copied());
        }
    }
    out
}

pub struct ProcStats {
    sys: Mutex<System>,
}

impl ProcStats {
    pub fn new() -> Self {
        Self { sys: Mutex::new(System::new()) }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionStat {
    pub id: String,
    pub pid: Option<u32>,
    pub cpu_percent: f32,
    pub memory_bytes: u64,
    pub alive: bool,
}

#[tauri::command]
pub fn pty_session_stats(
    pty: State<'_, crate::pty::PtyManager>,
    stats: State<'_, ProcStats>,
) -> Result<Vec<SessionStat>, String> {
    let sessions = pty.session_pids();
    let mut sys = stats.sys.lock().map_err(|e| e.to_string())?;
    // Full refresh: needed so the parent→children index covers the whole tree
    // (PTY's direct child is the login shell; the real CLI is a grandchild).
    // Cheap enough at ~1 Hz from the panel.
    sys.refresh_processes(ProcessesToUpdate::All, true);

    let mut children: HashMap<Pid, Vec<Pid>> = HashMap::new();
    for (pid, proc_ref) in sys.processes() {
        if let Some(parent) = proc_ref.parent() {
            children.entry(parent).or_default().push(*pid);
        }
    }

    let mut out = Vec::with_capacity(sessions.len());
    for (id, root_pid) in sessions {
        let Some(root) = root_pid else {
            out.push(SessionStat {
                id,
                pid: None,
                cpu_percent: 0.0,
                memory_bytes: 0,
                alive: false,
            });
            continue;
        };
        let root_pid_t = Pid::from_u32(root);
        if sys.process(root_pid_t).is_none() {
            out.push(SessionStat {
                id,
                pid: Some(root),
                cpu_percent: 0.0,
                memory_bytes: 0,
                alive: false,
            });
            continue;
        }

        let mut stack = vec![root_pid_t];
        let mut cpu = 0.0f32;
        let mut mem: u64 = 0;
        while let Some(pid) = stack.pop() {
            if let Some(p) = sys.process(pid) {
                cpu += p.cpu_usage();
                mem = mem.saturating_add(p.memory());
            }
            if let Some(kids) = children.get(&pid) {
                stack.extend(kids.iter().copied());
            }
        }

        out.push(SessionStat {
            id,
            pid: Some(root),
            cpu_percent: cpu,
            memory_bytes: mem,
            alive: true,
        });
    }
    Ok(out)
}

#[tauri::command]
pub fn pty_force_kill(
    pty: State<'_, crate::pty::PtyManager>,
    stats: State<'_, ProcStats>,
    id: String,
) -> Result<(), String> {
    let root_pid = pty
        .session_pids()
        .into_iter()
        .find(|(sid, _)| sid == &id)
        .and_then(|(_, p)| p);

    if let Some(root) = root_pid {
        let mut sys = stats.sys.lock().map_err(|e| e.to_string())?;
        sys.refresh_processes(ProcessesToUpdate::All, true);
        let tree = build_process_tree(&sys, Pid::from_u32(root));
        // Leaves first so a parent doesn't reap+rename children mid-walk.
        for pid in tree.iter().rev() {
            if let Some(p) = sys.process(*pid) {
                let _ = p.kill();
            }
        }
    }

    // Cleans up the PtyManager entry and the direct child (no-op if the SIGKILL
    // above already reaped it). Safe to call even when root_pid was None — the
    // session may exist with a yet-uncaptured pid.
    pty.kill_session(&id)
}
