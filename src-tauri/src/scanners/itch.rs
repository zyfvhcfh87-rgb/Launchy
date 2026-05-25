use std::path::{Path, PathBuf};
use rusqlite::Connection;
use serde_json::Value;
use crate::models::game::{Game, ProcessSignature};
use crate::db::queries;

fn get_itch_db_path() -> Option<PathBuf> {
    let home = dirs::home_dir()?;
    
    // Candidates for itch.io sqlite.db path
    let candidates = [
        // Windows
        dirs::config_dir().map(|d| d.join("itch").join("db").join("sqlite.db")),
        // macOS / Linux config/data dirs
        dirs::data_dir().map(|d| d.join("itch").join("db").join("sqlite.db")),
        // Fallback standard paths
        Some(home.join("AppData").join("Roaming").join("itch").join("db").join("sqlite.db")),
        Some(home.join("Library").join("Application Support").join("itch").join("db").join("sqlite.db")),
        Some(home.join(".config").join("itch").join("db").join("sqlite.db")),
    ];

    for candidate in &candidates {
        if let Some(ref path) = candidate {
            if path.exists() && path.is_file() {
                return Some(path.clone());
            }
        }
    }

    None
}

fn get_itch_apps_dir() -> Option<PathBuf> {
    // itch installs games inside Roaming/itch/apps by default
    dirs::config_dir().map(|d| d.join("itch").join("apps"))
}

pub fn scan_itch_library(conn: &Connection) -> Result<Vec<Game>, String> {
    let mut discovered = Vec::new();

    let db_path = match get_itch_db_path() {
        Some(p) => p,
        None => return Ok(Vec::new()), // itch.io not installed or database not found
    };

    // Open connection to itch's sqlite database in read-only mode
    let itch_conn = Connection::open_with_flags(&db_path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|e| format!("Failed to open itch.io database: {}", e))?;

    let mut stmt = itch_conn.prepare("SELECT id, game, installFolder, launchCandidates FROM caves")
        .map_err(|e| format!("Failed to prepare itch query: {}", e))?;

    let cave_iter = stmt.query_map([], |row| {
        let cave_id: String = row.get(0)?;
        let game_json: String = row.get(1)?;
        let install_folder: String = row.get(2)?;
        let launch_candidates_json: String = row.get(3)?;
        Ok((cave_id, game_json, install_folder, launch_candidates_json))
    }).map_err(|e| format!("Failed to execute itch query: {}", e))?;

    let apps_dir = get_itch_apps_dir();

    for cave in cave_iter.flatten() {
        let (cave_id, game_json, install_folder, launch_candidates_json) = cave;

        // Parse game metadata from JSON
        let game_val: Value = match serde_json::from_str(&game_json) {
            Ok(v) => v,
            _ => continue,
        };

        let title = match game_val["title"].as_str() {
            Some(t) if !t.trim().is_empty() => t.to_string(),
            _ => continue, // Title is required
        };

        let itch_game_id = match game_val["id"].as_i64() {
            Some(id) => id.to_string(),
            None => cave_id.clone(),
        };

        // Determine absolute installation path
        let install_path = Path::new(&install_folder);
        let absolute_install_path = if install_path.is_absolute() {
            install_path.to_path_buf()
        } else if let Some(ref apps) = apps_dir {
            apps.join(&install_folder)
        } else {
            continue;
        };

        if !absolute_install_path.exists() {
            continue;
        }

        // Parse first candidate executable relative path from launchCandidates JSON
        let mut relative_exe = String::new();
        if let Ok(candidates_val) = serde_json::from_str::<Value>(&launch_candidates_json) {
            if let Some(arr) = candidates_val.as_array() {
                for item in arr {
                    if let Some(p) = item["path"].as_str() {
                        if p.ends_with(".exe") || !cfg!(target_os = "windows") {
                            relative_exe = p.to_string();
                            break;
                        }
                    }
                }
            }
        }

        // Fallback: If no launch candidate, search folder for executables
        if relative_exe.is_empty() {
            if let Ok(entries) = std::fs::read_dir(&absolute_install_path) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_file() && path.extension().map_or(false, |ext| ext == "exe") {
                        relative_exe = path.file_name().unwrap().to_string_lossy().to_string();
                        break;
                    }
                }
            }
        }

        let now = chrono::Local::now().to_rfc3339();
        
        let exe_filename = if !relative_exe.is_empty() {
            Some(relative_exe)
        } else {
            None
        };

        let game = Game {
            id: format!("itch_{}", itch_game_id),
            source: "itch".to_string(),
            source_app_id: Some(itch_game_id),
            title,
            install_path: Some(absolute_install_path.to_string_lossy().to_string()),
            launch_method: "exec".to_string(), // Standalone direct binary execute
            launch_uri: None,
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

    Ok(discovered)
}
