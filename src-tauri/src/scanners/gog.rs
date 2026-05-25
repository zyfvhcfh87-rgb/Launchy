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

    Ok(discovered)
}
