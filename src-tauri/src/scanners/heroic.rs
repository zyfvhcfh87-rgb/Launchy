use std::fs;
use std::path::{Path, PathBuf};
use rusqlite::Connection;
use serde_json::Value;
use crate::models::game::{Game, ProcessSignature};
use crate::db::queries;

#[allow(unused_mut, unused_variables)]
fn get_heroic_config_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    let home = match dirs::home_dir() {
        Some(h) => h,
        None => return dirs,
    };

    #[cfg(target_os = "linux")]
    {
        // 1. Standard config directory
        dirs.push(home.join(".config").join("heroic"));
        // 2. Flatpak config directory
        dirs.push(home.join(".var").join("app").join("com.heroicgameslauncher.hgl").join("config").join("heroic"));
    }

    #[cfg(target_os = "macos")]
    {
        dirs.push(home.join("Library").join("Application Support").join("heroic"));
    }

    dirs
}

pub fn scan_heroic_library(conn: &Connection) -> Result<Vec<Game>, String> {
    let mut discovered = Vec::new();
    let config_dirs = get_heroic_config_dirs();

    if config_dirs.is_empty() {
        return Ok(Vec::new());
    }

    let stores = ["epic_store", "gog_store"];

    for config_dir in config_dir_loop(config_dirs) {
        for store in &stores {
            let installed_json_path = config_dir.join(store).join("installed.json");
            if !installed_json_path.exists() {
                continue;
            }

            let content = match fs::read_to_string(&installed_json_path) {
                Ok(c) => c,
                _ => continue,
            };

            let json: Value = match serde_json::from_str(&content) {
                Ok(v) => v,
                _ => continue,
            };

            // Parse Heroic games list (can be an object map or an array list)
            let mut games_list = Vec::new();

            if let Some(arr) = json.as_array() {
                for item in arr {
                    games_list.push(item.clone());
                }
            } else if let Some(arr) = json["installed"].as_array() {
                for item in arr {
                    games_list.push(item.clone());
                }
            } else if let Some(obj) = json.as_object() {
                // If it is a map where each key is an AppName and value is game metadata
                for (app_name, val) in obj {
                    let mut item = val.clone();
                    if item.is_object() {
                        if item["appName"].is_null() {
                            item["appName"] = Value::String(app_name.clone());
                        }
                        games_list.push(item);
                    }
                }
            }

            for game_val in games_list {
                let app_name = match game_val["appName"].as_str() {
                    Some(s) if !s.trim().is_empty() => s.to_string(),
                    _ => continue,
                };

                let title = match game_val["title"].as_str() {
                    Some(s) if !s.trim().is_empty() => s.to_string(),
                    _ => continue,
                };

                let install_dir = match game_val["installPath"].as_str() {
                    Some(s) if !s.trim().is_empty() => s.to_string(),
                    _ => continue,
                };

                let launch_exe = game_val["executable"].as_str().unwrap_or_default().to_string();
                let platform = game_val["platform"].as_str().unwrap_or(if *store == "epic_store" { "epic" } else { "gog" }).to_string();

                let install_path = Path::new(&install_dir);
                if !install_path.exists() {
                    continue;
                }

                // Determine launch URI using Heroic's URI protocol handler
                let launch_uri = format!("heroic://launch/{}/{}", platform, app_name);
                let now = chrono::Local::now().to_rfc3339();

                let exe_filename = if !launch_exe.is_empty() {
                    Some(Path::new(&launch_exe).file_name().unwrap().to_string_lossy().to_string())
                } else {
                    None
                };

                let game = Game {
                    id: format!("heroic_{}_{}", platform, app_name),
                    source: platform,
                    source_app_id: Some(app_name),
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

    Ok(discovered)
}

fn config_dir_loop(dirs: Vec<PathBuf>) -> impl Iterator<Item = PathBuf> {
    dirs.into_iter()
}
