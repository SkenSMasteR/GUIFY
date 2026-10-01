mod cli;
mod commands;
mod config;
mod discovery;
mod error;
mod extension;
mod snippets;
mod state;
mod theme;

use state::AppState;
use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::new())
        .setup(|app| {
            let handle = app.handle().clone();
            let state = handle.state::<AppState>();
            tauri::async_runtime::block_on(state::load_installs(&handle, &state));
            tauri::async_runtime::block_on(snippets::load(&handle, &state));
            tauri::async_runtime::block_on(snippets::load_market(&handle, &state));
            tauri::async_runtime::spawn(snippets::serve(handle.clone()));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_status,
            commands::run_cli,
            commands::watch_start,
            commands::watch_stop,
            commands::watch_running,
            commands::discover_themes,
            commands::discover_extensions,
            commands::get_readme,
            commands::list_local_themes,
            commands::list_local_extensions,
            commands::install_theme,
            commands::remove_theme,
            commands::set_active_theme,
            commands::install_extension,
            commands::remove_extension,
            commands::set_extension_enabled,
            commands::get_installs,
            commands::check_update,
            commands::fix_spicetify,
            commands::set_devtools,
            commands::window_controls,
            commands::list_snippets,
            commands::save_snippet,
            commands::delete_snippet,
            commands::set_snippets_enabled,
            commands::discover_snippets,
            commands::list_market_snippets,
            commands::add_market_snippet,
            commands::remove_market_snippet,
            commands::toggle_market_snippet,
            commands::snippets_connected
        ])
        .run(tauri::generate_context!())
        .expect("error while running GUIFY");
}
