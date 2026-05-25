use crate::db::{queries, establish_connection};
use crate::models::game::{Game, LibrarySource};
use crate::scanners::{steam, epic, manual, gog, uplay, ea, itch};
use crate::launcher::{steam_launcher, epic_launcher, manual_launcher, gog_launcher, uplay_launcher, ea_launcher, itch_launcher};

#[tauri::command]
pub async fn get_games() -> Result<Vec<Game>, String> {
    let conn = establish_connection().map_err(|e| e.to_string())?;
    queries::get_all_games(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn scan_libraries() -> Result<Vec<Game>, String> {
    let conn = establish_connection().map_err(|e| e.to_string())?;
    
    // Scan Steam
    let _ = steam::scan_steam_library(&conn);
    
    // Scan Epic
    let _ = epic::scan_epic_library(&conn);

    // Scan GOG Galaxy
    let _ = gog::scan_gog_library(&conn);

    // Scan Ubisoft Connect
    let _ = uplay::scan_uplay_library(&conn);

    // Scan EA App
    let _ = ea::scan_ea_library(&conn);

    // Scan itch.io
    let _ = itch::scan_itch_library(&conn);

    // Trigger background artwork fetch for Steam games
    crate::scanners::artwork::trigger_artwork_fetch_background();

    queries::get_all_games(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn launch_game(game_id: String) -> Result<(), String> {
    let conn = establish_connection().map_err(|e| e.to_string())?;
    let game = queries::get_game_by_id(&conn, &game_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Game not found in library".to_string())?;

    // Optimistically update status to launching
    queries::update_status(&conn, &game_id, "launching").map_err(|e| e.to_string())?;

    let launch_result = match game.source.as_str() {
        "steam" => steam_launcher::launch(&game),
        "epic" => epic_launcher::launch(&game),
        "manual" => manual_launcher::launch(&game),
        "gog" => gog_launcher::launch(&game),
        "uplay" => uplay_launcher::launch(&game),
        "ea" => ea_launcher::launch(&game),
        "itch" => itch_launcher::launch(&game),
        _ => Err("Unknown library source".to_string()),
    };

    if let Err(err) = launch_result {
        // Roll back status to installed on failure
        let _ = queries::update_status(&conn, &game_id, "error");
        return Err(err);
    }

    Ok(())
}

#[tauri::command]
pub async fn toggle_favorite(game_id: String) -> Result<(), String> {
    let conn = establish_connection().map_err(|e| e.to_string())?;
    queries::toggle_favorite(&conn, &game_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_hidden(game_id: String, hidden: bool) -> Result<(), String> {
    let conn = establish_connection().map_err(|e| e.to_string())?;
    queries::set_hidden(&conn, &game_id, hidden).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_manual_game(
    title: String,
    exePath: String,
    args: Option<String>,
    artworkPath: Option<String>,
) -> Result<Game, String> {
    let conn = establish_connection().map_err(|e| e.to_string())?;
    manual::add_manual_game(&conn, title, exePath, args, artworkPath)
}

#[tauri::command]
pub async fn open_install_folder(game_id: String) -> Result<(), String> {
    let conn = establish_connection().map_err(|e| e.to_string())?;
    let game = queries::get_game_by_id(&conn, &game_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Game not found".to_string())?;

    let install_path = game.install_path.ok_or_else(|| "No installation folder registered".to_string())?;
    
    open::that(&install_path)
        .map_err(|e| format!("Failed to open install folder: {}", e))?;
    
    Ok(())
}

#[tauri::command]
pub async fn open_source_client(game_id: String) -> Result<(), String> {
    let conn = establish_connection().map_err(|e| e.to_string())?;
    let game = queries::get_game_by_id(&conn, &game_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Game not found".to_string())?;

    match game.source.as_str() {
        "steam" => {
            open::that("steam://")
                .map_err(|e| format!("Failed to open Steam: {}", e))?;
        }
        "epic" => {
            open::that("com.epicgames.launcher://")
                .map_err(|e| format!("Failed to open Epic Games Launcher: {}", e))?;
        }
        _ => return Err("Standalone games do not have a platform client".to_string()),
    }
    Ok(())
}

#[tauri::command]
pub async fn get_library_sources() -> Result<Vec<LibrarySource>, String> {
    let conn = establish_connection().map_err(|e| e.to_string())?;
    queries::get_library_sources(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_library_source(source: String, path: String) -> Result<LibrarySource, String> {
    let conn = establish_connection().map_err(|e| e.to_string())?;
    
    // Check if the directory path actually exists
    let path_buf = std::path::PathBuf::from(&path);
    if !path_buf.exists() {
        return Err("The specified library folder path does not exist.".to_string());
    }

    let now = chrono::Local::now().to_rfc3339();
    let source_id = format!("source_{}_{}", source, chrono::Local::now().timestamp_millis());

    let library_source = LibrarySource {
        id: source_id,
        source: source.clone(),
        detected_path: path,
        enabled: true,
        last_scan_at: None,
        created_at: now.clone(),
        updated_at: now,
    };

    queries::insert_library_source(&conn, &library_source).map_err(|e| e.to_string())?;
    Ok(library_source)
}

#[tauri::command]
pub async fn remove_library_source(id: String) -> Result<(), String> {
    let conn = establish_connection().map_err(|e| e.to_string())?;
    queries::remove_library_source(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_game_artwork(game_id: String, artwork_path: Option<String>) -> Result<(), String> {
    let conn = establish_connection().map_err(|e| e.to_string())?;

    if let Some(path_str) = artwork_path {
        let src_path = std::path::Path::new(&path_str);
        if !src_path.exists() {
            return Err("The selected image file does not exist.".to_string());
        }

        // Determine extension, default to "jpg"
        let ext = src_path.extension()
            .map(|e| e.to_string_lossy().to_string())
            .unwrap_or_else(|| "jpg".to_string());

        // Resolve game artwork directory inside cache
        let art_dir = crate::scanners::artwork::get_game_artwork_dir(&game_id);
        let dest_filename = format!("cover.{}", ext);
        let dest_path = art_dir.join(&dest_filename);

        // Copy selected file to cache
        std::fs::copy(src_path, &dest_path)
            .map_err(|e| format!("Failed to copy cover image to cache: {}", e))?;

        let dest_path_str = dest_path.to_string_lossy().to_string();

        // 1. Update the games table's compatibility artwork_path column
        queries::update_artwork_path(&conn, &game_id, Some(dest_path_str.clone())).map_err(|e| e.to_string())?;

        // 2. Update the game_artwork table
        let now = chrono::Local::now().to_rfc3339();
        let game = queries::get_game_by_id(&conn, &game_id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Game not found".to_string())?;

        let artwork = crate::models::game::GameArtwork {
            game_id: game_id.clone(),
            cover_path: Some(dest_path_str),
            hero_path: game.artwork.and_then(|a| a.hero_path), // retain existing hero if present
            logo_path: None,
            icon_path: None,
            source: "manual_override".to_string(),
            updated_at: now,
        };

        queries::insert_or_update_artwork(&conn, &artwork).map_err(|e| e.to_string())?;
    } else {
        // Clear artwork if None is passed
        queries::update_artwork_path(&conn, &game_id, None).map_err(|e| e.to_string())?;
        let _ = queries::delete_artwork(&conn, &game_id);
        
        // Also delete cache folder if we want to be tidy
        let art_dir = crate::scanners::artwork::get_game_artwork_dir(&game_id);
        let _ = std::fs::remove_dir_all(art_dir);
    }

    Ok(())
}

#[tauri::command]
pub async fn select_file(title: String, filter_name: String, extensions: Vec<String>) -> Result<Option<String>, String> {
    let mut dialog = rfd::FileDialog::new().set_title(&title);
    
    if !extensions.is_empty() {
        let ext_refs: Vec<&str> = extensions.iter().map(|s| s.as_str()).collect();
        dialog = dialog.add_filter(&filter_name, &ext_refs);
    }

    let selected = tauri::async_runtime::spawn_blocking(move || {
        dialog.pick_file()
    }).await.map_err(|e| e.to_string())?;

    Ok(selected.map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
pub async fn select_directory(title: String) -> Result<Option<String>, String> {
    let dialog = rfd::FileDialog::new().set_title(&title);

    let selected = tauri::async_runtime::spawn_blocking(move || {
        dialog.pick_folder()
    }).await.map_err(|e| e.to_string())?;

    Ok(selected.map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
pub async fn get_setting(key: String) -> Result<Option<String>, String> {
    let conn = establish_connection().map_err(|e| e.to_string())?;
    queries::get_setting(&conn, &key).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_setting(key: String, value: String) -> Result<(), String> {
    let conn = establish_connection().map_err(|e| e.to_string())?;
    queries::set_setting(&conn, &key, &value).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn fetch_game_metadata(game_id: String) -> Result<Game, String> {
    crate::scanners::metadata::fetch_and_save_metadata(&game_id)
}

#[tauri::command]
pub async fn export_backup(dest_path: String) -> Result<(), String> {
    crate::utils::backup::export_backup(&dest_path)
}

#[tauri::command]
pub async fn import_backup(src_path: String) -> Result<(), String> {
    crate::utils::backup::import_backup(&src_path)
}

#[tauri::command]
pub async fn sideload_manual_games_to_steam() -> Result<(), String> {
    crate::utils::steam_shortcuts::sideload_manual_games_to_steam()
}



