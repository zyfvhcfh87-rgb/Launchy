use std::fs;
use std::path::{Path, PathBuf};
use rusqlite::Connection;
use serde_json::Value;
use crate::models::game::{Game, ProcessSignature};
use crate::db::queries;

pub fn scan_epic_library(conn: &Connection) -> Result<Vec<Game>, String> {
    let mut manifest_dirs = Vec::new();

    // 1. Standard auto-detected path
    let default_dir = PathBuf::from("C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\Manifests");
    if default_dir.exists() {
        manifest_dirs.push(default_dir);
    }

    // 2. Fetch manually registered Epic manifest paths from SQLite
    if let Ok(custom_sources) = queries::get_library_sources(conn) {
        for src in custom_sources {
            if src.source == "epic" && src.enabled {
                let path = PathBuf::from(src.detected_path);
                if path.exists() && !manifest_dirs.contains(&path) {
                    manifest_dirs.push(path);
                }
            }
        }
    }

    let mut discovered = Vec::new();

    for manifest_dir in manifest_dirs {
        if let Ok(entries) = fs::read_dir(manifest_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() && path.extension().map_or(false, |ext| ext == "item") {
                    if let Ok(game) = parse_epic_manifest(&path) {
                        // Save to SQLite
                        if let Ok(()) = queries::insert_or_update_game(conn, &game) {
                            // Save process signature
                            if let Some(ref launch_exe) = game.launch_exe {
                                let sig = ProcessSignature {
                                    id: format!("sig_{}", game.id),
                                    game_id: game.id.clone(),
                                    exe_name: Some(launch_exe.clone()),
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

    Ok(discovered)
}

fn parse_epic_manifest(path: &Path) -> Result<Game, String> {
    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read manifest file: {}", e))?;

    let json: Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse manifest JSON: {}", e))?;

    let app_name = json["AppName"].as_str()
        .ok_or_else(|| "Missing AppName".to_string())?.to_string();

    let title = json["DisplayName"].as_str()
        .ok_or_else(|| "Missing DisplayName".to_string())?.to_string();

    let install_location = json["InstallLocation"].as_str()
        .ok_or_else(|| "Missing InstallLocation".to_string())?.to_string();

    let launch_executable = json["LaunchExecutable"].as_str().map(|s| s.to_string());
    
    let catalog_namespace = json["CatalogNamespace"].as_str().unwrap_or("");
    let catalog_item_id = json["CatalogItemId"].as_str().unwrap_or("");

    // Epic launch URI format
    let launch_uri = if !catalog_namespace.is_empty() && !catalog_item_id.is_empty() {
        format!(
            "com.epicgames.launcher://apps/{}%3A{}%3A{}?action=launch&silent=true",
            catalog_namespace, catalog_item_id, app_name
        )
    } else {
        format!(
            "com.epicgames.launcher://apps/{}?action=launch&silent=true",
            app_name
        )
    };

    let install_path = Path::new(&install_location);
    let is_installed = install_path.exists();
    let now = chrono::Local::now().to_rfc3339();

    Ok(Game {
        id: format!("epic_{}", app_name),
        source: "epic".to_string(),
        source_app_id: Some(app_name),
        title,
        install_path: Some(install_location),
        launch_method: "uri".to_string(),
        launch_uri: Some(launch_uri),
        launch_exe: launch_executable,
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
