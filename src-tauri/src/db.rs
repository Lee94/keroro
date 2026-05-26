use std::sync::Mutex;

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

pub struct Db(pub Mutex<Connection>);

const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS projects (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    path        TEXT NOT NULL UNIQUE,
    mascot      TEXT NOT NULL,
    position    INTEGER NOT NULL DEFAULT 0,
    created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at  INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS sessions (
    id              TEXT PRIMARY KEY,
    project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    kind            TEXT NOT NULL,
    title           TEXT NOT NULL,
    cli_session_id  TEXT,
    created_at      INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id);

CREATE TABLE IF NOT EXISTS project_layouts (
    project_id  TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
    tree_json   TEXT NOT NULL,
    updated_at  INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS app_state (
    key   TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS project_commands (
    id          TEXT PRIMARY KEY,
    project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title       TEXT,
    command     TEXT NOT NULL,
    position    INTEGER NOT NULL DEFAULT 0,
    created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at  INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE INDEX IF NOT EXISTS idx_project_commands_project ON project_commands(project_id);
"#;

pub fn open(app: &AppHandle) -> Result<Db, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("resolve app data dir: {e}"))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("create app data dir: {e}"))?;
    // Keep dev (`pnpm tauri dev`, a debug build) and production (release
    // bundle) on separate database files so experimenting locally can't
    // corrupt or churn the installed app's state.
    let filename = if cfg!(debug_assertions) {
        "keroro-dev.db"
    } else {
        "keroro.db"
    };
    let path = dir.join(filename);
    let conn = Connection::open(&path).map_err(|e| format!("open sqlite: {e}"))?;
    conn.pragma_update(None, "journal_mode", "WAL")
        .map_err(|e| format!("set WAL: {e}"))?;
    conn.pragma_update(None, "foreign_keys", "ON")
        .map_err(|e| format!("set foreign_keys: {e}"))?;
    conn.execute_batch(SCHEMA)
        .map_err(|e| format!("apply schema: {e}"))?;
    // Migration: add cli_session_id to existing sessions tables. Silently
    // ignore the "duplicate column" error from sqlite for already-migrated DBs.
    let _ = conn.execute("ALTER TABLE sessions ADD COLUMN cli_session_id TEXT", []);
    // Migration: per-terminal last command, replayed (without CR) on next boot.
    let _ = conn.execute("ALTER TABLE sessions ADD COLUMN last_command TEXT", []);
    Ok(Db(Mutex::new(conn)))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectRow {
    pub id: String,
    pub name: String,
    pub path: String,
    pub mascot: String,
    #[serde(default)]
    pub position: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectCommandRow {
    pub id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    pub command: String,
    #[serde(default)]
    pub position: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionRow {
    pub id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub kind: String,
    pub title: String,
    #[serde(rename = "cliSessionId", default, skip_serializing_if = "Option::is_none")]
    pub cli_session_id: Option<String>,
    // Read-only on the replace path: the upsert SQL deliberately omits this
    // column so layout saves never blow away the last_command captured by the
    // terminal input handler. Populated by [`sessions_list`] so the frontend
    // can replay it on the next boot.
    #[serde(rename = "lastCommand", default, skip_serializing_if = "Option::is_none")]
    pub last_command: Option<String>,
}

fn lock<'a>(db: &'a State<'_, Db>) -> Result<std::sync::MutexGuard<'a, Connection>, String> {
    db.0.lock().map_err(|e| format!("db lock poisoned: {e}"))
}

#[tauri::command]
pub fn projects_list(db: State<'_, Db>) -> Result<Vec<ProjectRow>, String> {
    let conn = lock(&db)?;
    let mut stmt = conn
        .prepare("SELECT id, name, path, mascot, position FROM projects ORDER BY position, created_at")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(ProjectRow {
                id: row.get(0)?,
                name: row.get(1)?,
                path: row.get(2)?,
                mascot: row.get(3)?,
                position: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

#[tauri::command]
pub fn project_upsert(db: State<'_, Db>, project: ProjectRow) -> Result<(), String> {
    let conn = lock(&db)?;
    conn.execute(
        "INSERT INTO projects (id, name, path, mascot, position)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(id) DO UPDATE SET
           name=excluded.name,
           path=excluded.path,
           mascot=excluded.mascot,
           position=excluded.position,
           updated_at=strftime('%s','now')",
        params![
            project.id,
            project.name,
            project.path,
            project.mascot,
            project.position,
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn projects_replace(db: State<'_, Db>, projects: Vec<ProjectRow>) -> Result<(), String> {
    let mut conn = lock(&db)?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    {
        let ids: Vec<String> = projects.iter().map(|p| p.id.clone()).collect();
        // Delete projects no longer in the list (cascade removes sessions + layout).
        if ids.is_empty() {
            tx.execute("DELETE FROM projects", []).map_err(|e| e.to_string())?;
        } else {
            let placeholders = std::iter::repeat_n("?", ids.len())
                .collect::<Vec<_>>()
                .join(",");
            let sql = format!("DELETE FROM projects WHERE id NOT IN ({placeholders})");
            let params_iter: Vec<&dyn rusqlite::ToSql> =
                ids.iter().map(|s| s as &dyn rusqlite::ToSql).collect();
            tx.execute(&sql, params_iter.as_slice())
                .map_err(|e| e.to_string())?;
        }
        let mut stmt = tx
            .prepare(
                "INSERT INTO projects (id, name, path, mascot, position)
                 VALUES (?1, ?2, ?3, ?4, ?5)
                 ON CONFLICT(id) DO UPDATE SET
                   name=excluded.name,
                   path=excluded.path,
                   mascot=excluded.mascot,
                   position=excluded.position,
                   updated_at=strftime('%s','now')",
            )
            .map_err(|e| e.to_string())?;
        for (idx, p) in projects.iter().enumerate() {
            stmt.execute(params![p.id, p.name, p.path, p.mascot, idx as i64])
                .map_err(|e| e.to_string())?;
        }
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn project_delete(db: State<'_, Db>, id: String) -> Result<(), String> {
    let conn = lock(&db)?;
    conn.execute("DELETE FROM projects WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn sessions_list(db: State<'_, Db>, project_id: String) -> Result<Vec<SessionRow>, String> {
    let conn = lock(&db)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, kind, title, cli_session_id, last_command FROM sessions
             WHERE project_id = ?1 ORDER BY created_at",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![project_id], |row| {
            Ok(SessionRow {
                id: row.get(0)?,
                project_id: row.get(1)?,
                kind: row.get(2)?,
                title: row.get(3)?,
                cli_session_id: row.get(4)?,
                last_command: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

#[tauri::command]
pub fn sessions_replace(
    db: State<'_, Db>,
    project_id: String,
    sessions: Vec<SessionRow>,
) -> Result<(), String> {
    let mut conn = lock(&db)?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    {
        // Delete sessions in this project not in the new list.
        let ids: Vec<String> = sessions.iter().map(|s| s.id.clone()).collect();
        if ids.is_empty() {
            tx.execute(
                "DELETE FROM sessions WHERE project_id = ?1",
                params![project_id],
            )
            .map_err(|e| e.to_string())?;
        } else {
            let placeholders = std::iter::repeat_n("?", ids.len())
                .collect::<Vec<_>>()
                .join(",");
            let sql = format!(
                "DELETE FROM sessions WHERE project_id = ? AND id NOT IN ({placeholders})"
            );
            let mut bind: Vec<&dyn rusqlite::ToSql> = Vec::with_capacity(ids.len() + 1);
            bind.push(&project_id);
            for id in &ids {
                bind.push(id);
            }
            tx.execute(&sql, bind.as_slice())
                .map_err(|e| e.to_string())?;
        }
        let mut stmt = tx
            .prepare(
                "INSERT INTO sessions (id, project_id, kind, title, cli_session_id)
                 VALUES (?1, ?2, ?3, ?4, ?5)
                 ON CONFLICT(id) DO UPDATE SET
                   project_id=excluded.project_id,
                   kind=excluded.kind,
                   title=excluded.title,
                   cli_session_id=excluded.cli_session_id",
            )
            .map_err(|e| e.to_string())?;
        for s in &sessions {
            stmt.execute(params![s.id, s.project_id, s.kind, s.title, s.cli_session_id])
                .map_err(|e| e.to_string())?;
        }
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

// Set the last command typed in a shell-kind session. Called from the
// terminal input handler each time the user presses Enter, so it can be
// re-typed (without CR) into the PTY on the next boot of this session.
#[tauri::command]
pub fn session_last_command_set(
    db: State<'_, Db>,
    id: String,
    command: Option<String>,
) -> Result<(), String> {
    let conn = lock(&db)?;
    conn.execute(
        "UPDATE sessions SET last_command = ?1 WHERE id = ?2",
        params![command, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn layout_get(db: State<'_, Db>, project_id: String) -> Result<Option<String>, String> {
    let conn = lock(&db)?;
    conn.query_row(
        "SELECT tree_json FROM project_layouts WHERE project_id = ?1",
        params![project_id],
        |row| row.get::<_, String>(0),
    )
    .optional()
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn layout_set(
    db: State<'_, Db>,
    project_id: String,
    tree_json: String,
) -> Result<(), String> {
    let conn = lock(&db)?;
    conn.execute(
        "INSERT INTO project_layouts (project_id, tree_json)
         VALUES (?1, ?2)
         ON CONFLICT(project_id) DO UPDATE SET
           tree_json=excluded.tree_json,
           updated_at=strftime('%s','now')",
        params![project_id, tree_json],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn active_project_get(db: State<'_, Db>) -> Result<Option<String>, String> {
    let conn = lock(&db)?;
    conn.query_row(
        "SELECT value FROM app_state WHERE key = 'active_project_id'",
        [],
        |row| row.get::<_, Option<String>>(0),
    )
    .optional()
    .map(|v| v.flatten())
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn active_project_set(db: State<'_, Db>, id: Option<String>) -> Result<(), String> {
    let conn = lock(&db)?;
    conn.execute(
        "INSERT INTO app_state (key, value) VALUES ('active_project_id', ?1)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn project_commands_list(
    db: State<'_, Db>,
    project_id: String,
) -> Result<Vec<ProjectCommandRow>, String> {
    let conn = lock(&db)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, title, command, position FROM project_commands
             WHERE project_id = ?1 ORDER BY position, created_at",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![project_id], |row| {
            Ok(ProjectCommandRow {
                id: row.get(0)?,
                project_id: row.get(1)?,
                title: row.get(2)?,
                command: row.get(3)?,
                position: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

#[tauri::command]
pub fn project_commands_replace(
    db: State<'_, Db>,
    project_id: String,
    commands: Vec<ProjectCommandRow>,
) -> Result<(), String> {
    let mut conn = lock(&db)?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    {
        let ids: Vec<String> = commands.iter().map(|c| c.id.clone()).collect();
        if ids.is_empty() {
            tx.execute(
                "DELETE FROM project_commands WHERE project_id = ?1",
                params![project_id],
            )
            .map_err(|e| e.to_string())?;
        } else {
            let placeholders = std::iter::repeat_n("?", ids.len())
                .collect::<Vec<_>>()
                .join(",");
            let sql = format!(
                "DELETE FROM project_commands WHERE project_id = ? AND id NOT IN ({placeholders})"
            );
            let mut bind: Vec<&dyn rusqlite::ToSql> = Vec::with_capacity(ids.len() + 1);
            bind.push(&project_id);
            for id in &ids {
                bind.push(id);
            }
            tx.execute(&sql, bind.as_slice())
                .map_err(|e| e.to_string())?;
        }
        let mut stmt = tx
            .prepare(
                "INSERT INTO project_commands (id, project_id, title, command, position)
                 VALUES (?1, ?2, ?3, ?4, ?5)
                 ON CONFLICT(id) DO UPDATE SET
                   project_id=excluded.project_id,
                   title=excluded.title,
                   command=excluded.command,
                   position=excluded.position,
                   updated_at=strftime('%s','now')",
            )
            .map_err(|e| e.to_string())?;
        for (idx, c) in commands.iter().enumerate() {
            stmt.execute(params![
                c.id,
                c.project_id,
                c.title,
                c.command,
                idx as i64
            ])
            .map_err(|e| e.to_string())?;
        }
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}
