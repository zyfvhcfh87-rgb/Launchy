use std::fs;
use std::path::{Path, PathBuf};
use rusqlite::Connection;
use regex::Regex;
use crate::models::game::{Game, ProcessSignature};
use crate::db::queries;

// Detect Steam installation folder on Windows
pub fn detect_steam_path() -> Option<PathBuf> {
    // Try common installation paths first
    let paths = [
        PathBuf::from("C:\\Program Files (x86)\\Steam"),
        PathBuf::from("C:\\Program Files\\Steam"),
    ];

    for path in &paths {
        if path.exists() {
            return Some(path.clone());
        }
    }

    // Fallback: Check registry if we wanted to (but we'll keep it simple & fast with standard folders)
    None
}

// Simple VDF parser helper to get a string value by key
fn get_vdf_value(vdf_content: &str, key: &str) -> Option<String> {
    // Matches "key" "value" or "key"  "value"
    let pattern = format!(r#""{}"\s+"([^"]+)"#, regex::escape(key));
    if let Ok(re) = Regex::new(&pattern) {
        if let Some(caps) = re.captures(vdf_content) {
            return Some(caps[1].to_string());
        }
    }
    None
}

// Extract library paths from libraryfolders.vdf
fn parse_library_folders(vdf_content: &str) -> Vec<PathBuf> {
    let mut folders = Vec::new();
    // Matches "path" "C:\\Program Files..."
    let re = Regex::new(r#""path""\s+"([^"]+)""#).unwrap();
    for cap in re.captures_iter(vdf_content) {
        let path_str = cap[1].replace("\\\\", "\\");
        let path = PathBuf::from(path_str);
        if path.exists() {
            folders.push(path);
        }
    }
    folders
}

pub fn scan_steam_library(conn: &Connection) -> Result<Vec<Game>, String> {
    let mut library_folders = Vec::new();

    // 1. Try to auto-detect Steam folder
    if let Some(steam_path) = detect_steam_path() {
        library_folders.push(steam_path.clone());

        let libraryfolders_vdf = steam_path.join("steamapps").join("libraryfolders.vdf");
        if libraryfolders_vdf.exists() {
            if let Ok(vdf_content) = fs::read_to_string(&libraryfolders_vdf) {
                let auto_folders = parse_library_folders(&vdf_content);
                for folder in auto_folders {
                    if !library_folders.contains(&folder) {
                        library_folders.push(folder);
                    }
                }
            }
        }
    }

    // 2. Fetch manually registered Steam library paths from SQLite
    if let Ok(custom_sources) = queries::get_library_sources(conn) {
        for src in custom_sources {
            if src.source == "steam" && src.enabled {
                let path = PathBuf::from(src.detected_path);
                if path.exists() && !library_folders.contains(&path) {
                    library_folders.push(path);
                }
            }
        }
    }

    let mut discovered_games = Vec::new();

    for folder in library_folders {
        let steamapps_path = folder.join("steamapps");
        let scan_path = if steamapps_path.exists() {
            steamapps_path
        } else {
            // User might have selected the 'steamapps' folder directly!
            if folder.file_name().map_or(false, |f| f == "steamapps") {
                folder.clone()
            } else {
                continue;
            }
        };

        // List manifest files
        if let Ok(entries) = fs::read_dir(&scan_path) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() && path.extension().map_or(false, |ext| ext == "acf") {
                    let file_name = path.file_name().unwrap().to_string_lossy();
                    if file_name.starts_with("appmanifest_") {
                        let library_root = scan_path.parent().unwrap_or(&scan_path);
                        if let Ok(game) = parse_acf_file(&path, library_root) {
                            // Save to SQLite
                            if let Ok(()) = queries::insert_or_update_game(conn, &game) {
                                // Add process signature hint using install folder
                                if let Some(ref install_path) = game.install_path {
                                    let sig = ProcessSignature {
                                        id: format!("sig_{}", game.id),
                                        game_id: game.id.clone(),
                                        exe_name: None,
                                        exe_path: Some(install_path.clone()),
                                        confidence: 100,
                                        last_seen_pid: None,
                                        created_at: chrono::Local::now().to_rfc3339(),
                                        updated_at: chrono::Local::now().to_rfc3339(),
                                    };
                                    let _ = queries::insert_or_update_signature(conn, &sig);
                                }
                                discovered_games.push(game);
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(discovered_games)
}

fn parse_acf_file(path: &Path, library_root: &Path) -> Result<Game, String> {
    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read ACF file: {}", e))?;

    let appid = get_vdf_value(&content, "appid")
        .or_else(|| get_vdf_value(&content, "appid")) // Try standard cases
        .ok_or_else(|| "Failed to parse appid".to_string())?;

    let title = get_vdf_value(&content, "name")
        .ok_or_else(|| "Failed to parse name".to_string())?;

    let installdir = get_vdf_value(&content, "installdir")
        .ok_or_else(|| "Failed to parse installdir".to_string())?;

    let install_path = library_root.join("steamapps").join("common").join(&installdir);
    let install_path_str = install_path.to_string_lossy().to_string();

    let now = chrono::Local::now().to_rfc3339();

    Ok(Game {
        id: format!("steam_{}", appid),
        source: "steam".to_string(),
        source_app_id: Some(appid.clone()),
        title,
        install_path: Some(install_path_str),
        launch_method: "uri".to_string(),
        launch_uri: Some(format!("steam://rungameid/{}", appid)),
        launch_exe: None, // Will match dynamically via process monitor
        launch_args: None,
        artwork_path: None, // Optional cover art
        status: if install_path.exists() { "installed".to_string() } else { "missing".to_string() },
        favorite: false,
        hidden: false,
        last_played_at: None,
        playtime_seconds: 0,
        created_at: now.clone(),
        updated_at: now,
    })
}
