mod claude;
mod db;
mod exec;
mod proc_stats;
mod pty;
mod sys_info;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(pty::PtyManager::new())
        .manage(exec::ExecManager::new())
        .manage(proc_stats::ProcStats::new())
        .setup(|app| {
            let database =
                db::open(app.handle()).map_err(|e| -> Box<dyn std::error::Error> { e.into() })?;
            app.manage(database);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            pty::pty_spawn,
            pty::pty_write,
            pty::pty_resize,
            pty::pty_kill,
            sys_info::detect_node_version,
            sys_info::detect_git_branch,
            sys_info::detect_git_status,
            sys_info::list_git_branches,
            sys_info::checkout_git_branch,
            sys_info::git_diff,
            sys_info::detect_clis,
            claude::claude_spawn_args,
            claude::claude_session_title,
            claude::claude_unlock_session,
            db::projects_list,
            db::project_upsert,
            db::projects_replace,
            db::project_delete,
            db::sessions_list,
            db::sessions_replace,
            db::session_last_command_set,
            db::layout_get,
            db::layout_set,
            db::active_project_get,
            db::active_project_set,
            db::project_commands_list,
            db::project_commands_replace,
            exec::command_run,
            exec::command_kill,
            exec::command_output,
            proc_stats::pty_session_stats,
            proc_stats::pty_force_kill,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
