use std::fs;
use std::path::{Path, PathBuf};
use rusqlite::Connection;
use crate::models::game::{Game, ProcessSignature};
use crate::db::queries;

#[cfg(target_os = "windows")]
use winreg::enums::HKEY_LOCAL_MACHINE;
#[cfg(target_os = "windows")]
use winreg::RegKey;

#[cfg(not(target_os = "windows"))]
pub fn scan_uplay_library(_conn: &Connection) -> Result<Vec<Game>, String> {
    Ok(Vec::new())
}

#[cfg(target_os = "windows")]
pub fn scan_uplay_library(conn: &Connection) -> Result<Vec<Game>, String> {
    let mut discovered = Vec::new();
    
    // Ubisoft Launcher registry paths
    let install_paths = [
        "SOFTWARE\\WOW6432Node\\Ubisoft\\Launcher\\Installs",
        "SOFTWARE\\Ubisoft\\Launcher\\Installs"
    ];

    // Standard configurations path
    let config_dir = PathBuf::from("C:\\Program Files (x86)\\Ubisoft\\Ubisoft Game Launcher\\cache\\configuration\\configurations");

    for reg_path in &install_paths {
        if let Ok(installs_key) = RegKey::predef(HKEY_LOCAL_MACHINE).open_subkey(*reg_path) {
            // Each subkey under Installs represents a Uplay Game ID
            for subkey_name in installs_key.enum_keys().flatten() {
                if let Ok(game_key) = installs_key.open_subkey(&subkey_name) {
                    let install_dir = match game_key.get_value::<String, _>("InstallDir") {
                        Ok(dir) if !dir.trim().is_empty() => dir.replace("/", "\\"),
                        _ => continue, // InstallDir is required
                    };

                    let uplay_id = subkey_name.clone();
                    let install_path = Path::new(&install_dir);

                    if !install_path.exists() {
                        continue;
                    }

                    // Attempt to parse game title and exe from configurations cache file
                    let mut title = String::new();
                    let mut launch_exe = String::new();

                    let config_file = config_dir.join(&uplay_id);
                    if config_file.exists() {
                        if let Ok(content) = fs::read_to_string(&config_file) {
                            // Find title (name: "Assassin's Creed") or (name: Assassin's Creed)
                            for line in content.lines() {
                                let trimmed = line.trim();
                                if trimmed.starts_with("name:") {
                                    let mut name_val = trimmed["name:".len()..].trim().to_string();
                                    // Strip surrounding quotes
                                    if (name_val.starts_with('"') && name_val.ends_with('"')) ||
                                       (name_val.starts_with('\'') && name_val.ends_with('\'')) {
                                        name_val = name_val[1..name_val.len() - 1].to_string();
                                    }
                                    title = name_val;
                                } else if trimmed.starts_with("relative_path:") {
                                    // Found a candidate executable relative path
                                    let mut exe_val = trimmed["relative_path:".len()..].trim().to_string();
                                    if (exe_val.starts_with('"') && exe_val.ends_with('"')) ||
                                       (exe_val.starts_with('\'') && exe_val.ends_with('\'')) {
                                        exe_val = exe_val[1..exe_val.len() - 1].to_string();
                                    }
                                    if exe_val.ends_with(".exe") {
                                        launch_exe = exe_val;
                                    }
                                }
                            }
                        }
                    }

                    // Fallbacks if config parsing failed
                    if title.is_empty() {
                        // Extract name of folder as fallback title
                        if let Some(folder_name) = install_path.file_name() {
                            title = folder_name.to_string_lossy().to_string();
                        } else {
                            title = format!("Uplay Game {}", uplay_id);
                        }
                    }

                    // Scan directory for executable if launch_exe is still empty
                    if launch_exe.is_empty() {
                        if let Ok(entries) = fs::read_dir(install_path) {
                            for entry in entries.flatten() {
                                let path = entry.path();
                                if path.is_file() && path.extension().map_or(false, |ext| ext == "exe") {
                                    let file_name = path.file_name().unwrap().to_string_lossy().to_string();
                                    // Ignore common launcher/utility files
                                    let name_lower = file_name.to_lowercase();
                                    if !name_lower.contains("unins") && !name_lower.contains("crash") && !name_lower.contains("cef") {
                                        launch_exe = file_name;
                                        break;
                                    }
                                }
                            }
                        }
                    }

                    let launch_uri = format!("uplay://launch/{}/0", uplay_id);
                    let now = chrono::Local::now().to_rfc3339();

                    // Resolve executable filename for process signatures
                    let exe_filename = if !launch_exe.is_empty() {
                        Some(Path::new(&launch_exe).file_name().unwrap().to_string_lossy().to_string())
                    } else {
                        None
                    };

                    let game = Game {
                        id: format!("uplay_{}", uplay_id),
                        source: "uplay".to_string(),
                        source_app_id: Some(uplay_id.clone()),
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
                        runner_type: None,
                        runner_path: None,
                        runner_prefix: None,
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
