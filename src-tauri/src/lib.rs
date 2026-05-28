pub mod models;
pub mod db;
pub mod scanners;
pub mod launcher;
pub mod process_monitor;
pub mod commands;
pub mod utils;
pub mod plugins;
pub mod discord_rpc;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Run database initialization and table schema migration on startup
            db::initialize_database().expect("Failed to initialize SQLite database");
            
            // Start the background process monitoring thread
            let app_handle = app.handle().clone();
            process_monitor::start_monitor(app_handle);

            // Trigger background artwork fetch for Steam games
            scanners::artwork::trigger_artwork_fetch_background();

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_games,
            commands::scan_libraries,
            commands::launch_game,
            commands::toggle_favorite,
            commands::set_hidden,
            commands::add_manual_game,
            commands::open_install_folder,
            commands::open_source_client,
            commands::get_library_sources,
            commands::add_library_source,
            commands::remove_library_source,
            commands::set_game_artwork,
            commands::select_file,
            commands::select_directory,
            commands::get_setting,
            commands::set_setting,
            commands::fetch_game_metadata,
            commands::export_backup,
            commands::import_backup,
            commands::sideload_manual_games_to_steam,
            commands::get_plugins,
            commands::toggle_plugin,
            commands::execute_plugin,
            commands::create_sample_plugin,
            commands::get_playtime_sessions,
            commands::get_all_categories,
            commands::create_category,
            commands::delete_category,
            commands::add_game_to_category,
            commands::remove_game_from_category,
            commands::get_game_categories
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
