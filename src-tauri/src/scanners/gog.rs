use std::path::{Path, PathBuf};
use rusqlite::Connection;
use crate::models::game::{Game, ProcessSignature};
use crate::db::queries;

#[cfg(target_os = "windows")]
use winreg::enums::HKEY_LOCAL_MACHINE;
#[cfg(target_os = "windows")]
use winreg::RegKey;

#[cfg(not(target_os = "windows"))]
pub fn scan_gog_library(_conn: &Connection) -> Result<Vec<Game>, String> {
    Ok(Vec::new())
}

#[cfg(target_os = "windows")]
pub fn scan_gog_library(conn: &Connection) -> Result<Vec<Game>, String> {
    let mut discovered = Vec::new();
    
    // Check both WOW6432Node and standard HKLM registry paths
    let paths = [
        "SOFTWARE\\WOW6432Node\\GOG.com\\Games",
        "SOFTWARE\\GOG.com\\Games"
    ];

    for registry_path in &paths {
        if let Ok(gog_key) = RegKey::predef(HKEY_LOCAL_MACHINE).open_subkey(*registry_path) {
            // Iterate over all subkeys (each subkey represents a game ID)
            for subkey_name in gog_key.enum_keys().flatten() {
                if let Ok(game_key) = gog_key.open_subkey(&subkey_name) {
                    let game_id = game_key.get_value::<String, _>("gameID").unwrap_or_else(|_| subkey_name.clone());
                    let title = match game_key.get_value::<String, _>("gameName") {
                        Ok(name) if !name.trim().is_empty() => name,
                        _ => continue, // title is mandatory
                    };

                    let install_dir = match game_key.get_value::<String, _>("path") {
                        Ok(p) if !p.trim().is_empty() => p,
                        _ => continue, // install directory path is mandatory
                    };

                    let relative_exe = game_key.get_value::<String, _>("exe").unwrap_or_default();
                    
                    let install_path = Path::new(&install_dir);
                    let full_exe_path = if !relative_exe.is_empty() {
                        install_path.join(&relative_exe)
                    } else {
                        PathBuf::new()
                    };

                    let is_installed = install_path.exists() && (relative_exe.is_empty() || full_exe_path.exists());
                    let now = chrono::Local::now().to_rfc3339();

                    // Parse the executable name (just filename) for tracking
                    let exe_name = if !relative_exe.is_empty() {
                        Path::new(&relative_exe).file_name()
                            .map(|f| f.to_string_lossy().to_string())
                    } else {
                        None
                    };

                    let launch_uri = format!("goggalaxy://launchGame/{}", game_id);

                    let game = Game {
                        id: format!("gog_{}", game_id),
                        source: "gog".to_string(),
                        source_app_id: Some(game_id.clone()),
                        title,
                        install_path: Some(install_dir),
                        launch_method: "uri".to_string(),
                        launch_uri: Some(launch_uri),
                        launch_exe: exe_name.clone(),
                        launch_args: None,
                        artwork_path: None,
                        status: if is_installed { "installed".to_string() } else { "missing".to_string() },
                        favorite: false,
                        hidden: false,
                        last_played_at: None,
                        playtime_seconds: 0,
                        created_at: now.clone(),
                        updated_at: now,
                        artwork: None,
                        description: None,
                        release_date: None,
                        genres: None,
                        developer: None,
                        esrb_rating: None,
                        runner_type: None,
                        runner_path: None,
                        runner_prefix: None,
                    };

                    // Save to SQLite
                    if let Ok(()) = queries::insert_or_update_game(conn, &game) {
                        // Register process signature if we have an executable
                        if let Some(exe) = exe_name {
                            let sig = ProcessSignature {
                                id: format!("sig_{}", game.id),
                                game_id: game.id.clone(),
                                exe_name: Some(exe),
                                exe_path: game.install_path.clone(),
                                confidence: 90,
                                last_seen_pid: None,
                                created_at: chrono::Local::now().to_rfc3339(),
                                updated_at: chrono::Local::now().to_rfc3339(),
                            };
                            let _ = queries::insert_or_update_signature(conn, &sig);
                        }
                        discovered.push(game);
                    }
                }
            }
        }
    }

    // 2. Fetch manually registered GOG library paths from SQLite
    if let Ok(custom_sources) = queries::get_library_sources(conn) {
        for src in custom_sources {
            if src.source == "gog" && src.enabled {
                let path = PathBuf::from(src.detected_path);
                if path.exists() {
                    scan_gog_directory(&path, conn, &mut discovered);
                }
            }
        }
    }

    // Deduplicate discovered games by ID
    discovered.sort_by_key(|g| g.id.clone());
    discovered.dedup_by_key(|g| g.id.clone());

    Ok(discovered)
}

fn parse_gog_info_file(info_path: &Path) -> Result<Game, String> {
    let content = std::fs::read_to_string(info_path)
        .map_err(|e| format!("Failed to read GOG info file: {}", e))?;
    let json: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse GOG info JSON: {}", e))?;

    let game_id = json["gameId"].as_str()
        .map(|s| s.to_string())
        .unwrap_or_else(|| {
            info_path.file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default()
                .replace("goggame-", "")
        });

    if game_id.is_empty() {
        return Err("Missing game ID in GOG info file".to_string());
    }

    let title = json["name"].as_str()
        .ok_or_else(|| "Missing game name in GOG info file".to_string())?
        .to_string();

    let install_dir = info_path.parent()
        .ok_or_else(|| "GOG info file has no parent directory".to_string())?
        .to_string_lossy()
        .to_string();

    let mut relative_exe = String::new();
    if let Some(tasks) = json["playTasks"].as_array() {
        for task in tasks {
            if task["type"].as_str() == Some("FileTask") {
                if let Some(p) = task["path"].as_str() {
                    relative_exe = p.to_string();
                    break;
                }
            }
        }
    }

    let install_path = Path::new(&install_dir);
    let full_exe_path = if !relative_exe.is_empty() {
        install_path.join(&relative_exe)
    } else {
        PathBuf::new()
    };

    let is_installed = install_path.exists() && (relative_exe.is_empty() || full_exe_path.exists());
    let now = chrono::Local::now().to_rfc3339();

    let exe_name = if !relative_exe.is_empty() {
        Path::new(&relative_exe).file_name()
            .map(|f| f.to_string_lossy().to_string())
    } else {
        None
    };

    let launch_uri = format!("goggalaxy://launchGame/{}", game_id);

    Ok(Game {
        id: format!("gog_{}", game_id),
        source: "gog".to_string(),
        source_app_id: Some(game_id),
        title,
        install_path: Some(install_dir),
        launch_method: "uri".to_string(),
        launch_uri: Some(launch_uri),
        launch_exe: exe_name,
        launch_args: None,
        artwork_path: None,
        status: if is_installed { "installed".to_string() } else { "missing".to_string() },
        favorite: false,
        hidden: false,
        last_played_at: None,
        playtime_seconds: 0,
        created_at: now.clone(),
        updated_at: now,
        artwork: None,
        description: None,
        release_date: None,
        genres: None,
        developer: None,
        esrb_rating: None,
        runner_type: None,
        runner_path: None,
        runner_prefix: None,
    })
}

fn scan_gog_directory(dir_path: &Path, conn: &Connection, discovered: &mut Vec<Game>) {
    // 1. Check if the directory itself contains a goggame-*.info file
    if let Ok(entries) = std::fs::read_dir(dir_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() && path.extension().map_or(false, |ext| ext == "info") {
                if let Some(file_name) = path.file_name().map(|f| f.to_string_lossy()) {
                    if file_name.starts_with("goggame-") {
                        if let Ok(game) = parse_gog_info_file(&path) {
                            if let Ok(()) = queries::insert_or_update_game(conn, &game) {
                                if let Some(ref exe) = game.launch_exe {
                                    let sig = ProcessSignature {
                                        id: format!("sig_{}", game.id),
                                        game_id: game.id.clone(),
                                        exe_name: Some(exe.clone()),
                                        exe_path: game.install_path.clone(),
                                        confidence: 90,
                                        last_seen_pid: None,
                                        created_at: chrono::Local::now().to_rfc3339(),
                                        updated_at: chrono::Local::now().to_rfc3339(),
                                    };
                                    let _ = queries::insert_or_update_signature(conn, &sig);
                                }
                                discovered.push(game);
                            }
                        }
                    }
                }
            }
        }
    }

    // 2. Also check subdirectories of the directory for goggame-*.info files
    if let Ok(entries) = std::fs::read_dir(dir_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                if let Ok(sub_entries) = std::fs::read_dir(&path) {
                    for sub_entry in sub_entries.flatten() {
                        let sub_path = sub_entry.path();
                        if sub_path.is_file() && sub_path.extension().map_or(false, |ext| ext == "info") {
                            if let Some(file_name) = sub_path.file_name().map(|f| f.to_string_lossy()) {
                                if file_name.starts_with("goggame-") {
                                    if let Ok(game) = parse_gog_info_file(&sub_path) {
                                        if let Ok(()) = queries::insert_or_update_game(conn, &game) {
                                            if let Some(ref exe) = game.launch_exe {
                                                let sig = ProcessSignature {
                                                    id: format!("sig_{}", game.id),
                                                    game_id: game.id.clone(),
                                                    exe_name: Some(exe.clone()),
                                                    exe_path: game.install_path.clone(),
                                                    confidence: 90,
                                                    last_seen_pid: None,
                                                    created_at: chrono::Local::now().to_rfc3339(),
                                                    updated_at: chrono::Local::now().to_rfc3339(),
                                                };
                                                let _ = queries::insert_or_update_signature(conn, &sig);
                                            }
                                            discovered.push(game);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
