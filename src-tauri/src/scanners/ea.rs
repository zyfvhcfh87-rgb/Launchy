use std::fs;
use std::path::Path;
use rusqlite::Connection;
use crate::models::game::{Game, ProcessSignature};
use crate::db::queries;

#[cfg(target_os = "windows")]
use winreg::enums::HKEY_LOCAL_MACHINE;
#[cfg(target_os = "windows")]
use winreg::RegKey;

#[cfg(not(target_os = "windows"))]
pub fn scan_ea_library(_conn: &Connection) -> Result<Vec<Game>, String> {
    Ok(Vec::new())
}

#[cfg(target_os = "windows")]
pub fn scan_ea_library(conn: &Connection) -> Result<Vec<Game>, String> {
    let mut discovered = Vec::new();
    
    // EA App / Origin registry paths
    let paths = [
        "SOFTWARE\\WOW6432Node\\Origin Games",
        "SOFTWARE\\Origin Games"
    ];

    for registry_path in &paths {
        if let Ok(origin_key) = RegKey::predef(HKEY_LOCAL_MACHINE).open_subkey(*registry_path) {
            // Iterate over all subkeys (each represents an Origin Offer ID)
            for subkey_name in origin_key.enum_keys().flatten() {
                if let Ok(game_key) = origin_key.open_subkey(&subkey_name) {
                    let offer_id = subkey_name.clone();
                    
                    let title = match game_key.get_value::<String, _>("DisplayName") {
                        Ok(val) if !val.trim().is_empty() => val,
                        _ => continue, // DisplayName is mandatory
                    };

                    let install_dir = match game_key.get_value::<String, _>("Install Dir") {
                        Ok(val) if !val.trim().is_empty() => val.replace("/", "\\"),
                        _ => continue, // Install Dir is mandatory
                    };

                    let install_path = Path::new(&install_dir);
                    if !install_path.exists() {
                        continue;
                    }

                    // Search the installation directory to find the most likely launcher executable
                    let mut launch_exe = String::new();
                    if let Ok(entries) = fs::read_dir(install_path) {
                        for entry in entries.flatten() {
                            let path = entry.path();
                            if path.is_file() && path.extension().map_or(false, |ext| ext == "exe") {
                                let file_name = path.file_name().unwrap().to_string_lossy().to_string();
                                let name_lower = file_name.to_lowercase();
                                // Ignore common helper files
                                if !name_lower.contains("unins") && 
                                   !name_lower.contains("crash") && 
                                   !name_lower.contains("cleanup") && 
                                   !name_lower.contains("touchup") &&
                                   !name_lower.contains("activation") &&
                                   !name_lower.contains("easervices") {
                                    launch_exe = file_name;
                                    break;
                                }
                            }
                        }
                    }

                    // Standard EA/Origin launch protocol
                    let launch_uri = format!("origin://launchgame/{}", offer_id);
                    let now = chrono::Local::now().to_rfc3339();

                    let exe_filename = if !launch_exe.is_empty() {
                        Some(launch_exe)
                    } else {
                        None
                    };

                    let game = Game {
                        id: format!("ea_{}", offer_id.replace(":", "_").replace("@", "_")),
                        source: "ea".to_string(),
                        source_app_id: Some(offer_id.clone()),
                        title,
                        install_path: Some(install_dir),
                        launch_method: "uri".to_string(),
                        launch_uri: Some(launch_uri),
                        launch_exe: exe_filename.clone(),
                        launch_args: None,
                        artwork_path: None,
                        status: "installed".to_string(),
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
                    };

                    // Save to SQLite
                    if let Ok(()) = queries::insert_or_update_game(conn, &game) {
                        // Register process signature
                        if let Some(exe) = exe_filename {
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

    Ok(discovered)
}
