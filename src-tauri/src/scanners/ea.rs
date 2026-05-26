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

    // 2. Fetch manually registered EA library paths from SQLite
    if let Ok(custom_sources) = queries::get_library_sources(conn) {
        for src in custom_sources {
            if src.source == "ea" && src.enabled {
                let path = std::path::PathBuf::from(src.detected_path);
                if path.exists() {
                    scan_ea_directory(&path, conn, &mut discovered);
                }
            }
        }
    }

    // Deduplicate discovered games by ID
    discovered.sort_by_key(|g| g.id.clone());
    discovered.dedup_by_key(|g| g.id.clone());

    Ok(discovered)
}

fn parse_ea_installer_xml(xml_path: &Path) -> Option<(String, String, String)> {
    let content = std::fs::read_to_string(xml_path).ok()?;
    
    // Extract gameID (Offer ID)
    let game_id_re = regex::Regex::new(r"<gameID>(.*?)</gameID>").ok()?;
    let offer_id = game_id_re.captures(&content)?
        .get(1)?
        .as_str()
        .trim()
        .to_string();

    // Extract title/displayName
    let mut title = String::new();
    let title_re = regex::Regex::new(r"<diplayName>(.*?)</diplayName>").ok(); // check for diplayName typo
    if let Some(re) = title_re {
        if let Some(caps) = re.captures(&content) {
            title = caps.get(1).map_or(String::new(), |m| m.as_str().trim().to_string());
        }
    }
    if title.is_empty() {
        if let Ok(re2) = regex::Regex::new(r"<displayName>(.*?)</displayName>") {
            if let Some(caps) = re2.captures(&content) {
                title = caps.get(1).map_or(String::new(), |m| m.as_str().trim().to_string());
            }
        }
    }

    // Extract launcher exe path
    let mut relative_exe = String::new();
    let launcher_re = regex::Regex::new(r"<filePath>(.*?)</filePath>").ok();
    if let Some(re) = launcher_re {
        if let Some(caps) = re.captures(&content) {
            relative_exe = caps.get(1).map_or(String::new(), |m| m.as_str().trim().to_string());
        }
    }

    if offer_id.is_empty() {
        None
    } else {
        Some((offer_id, title, relative_exe))
    }
}

fn scan_ea_directory(dir_path: &Path, conn: &Connection, discovered: &mut Vec<Game>) {
    // Check subdirectories for __Installer/installer.xml
    if let Ok(entries) = std::fs::read_dir(dir_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let installer_xml = path.join("__Installer").join("installer.xml");
                if installer_xml.exists() {
                    if let Some((offer_id, title, relative_exe)) = parse_ea_installer_xml(&installer_xml) {
                        let install_dir = path.to_string_lossy().to_string();
                        
                        let mut launch_exe = relative_exe;
                        if launch_exe.is_empty() {
                            // Fallback scan for exe in directory
                            if let Ok(files) = std::fs::read_dir(&path) {
                                for file in files.flatten() {
                                    let fpath = file.path();
                                    if fpath.is_file() && fpath.extension().map_or(false, |ext| ext == "exe") {
                                        let file_name = fpath.file_name().unwrap().to_string_lossy().to_string();
                                        let name_lower = file_name.to_lowercase();
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
                        }

                        let launch_uri = format!("origin://launchgame/{}", offer_id);
                        let now = chrono::Local::now().to_rfc3339();

                        let exe_filename = if !launch_exe.is_empty() {
                            Some(Path::new(&launch_exe).file_name().unwrap().to_string_lossy().to_string())
                        } else {
                            None
                        };

                        let game = Game {
                            id: format!("ea_{}", offer_id.replace(":", "_").replace("@", "_")),
                            source: "ea".to_string(),
                            source_app_id: Some(offer_id.clone()),
                            title: if title.is_empty() {
                                path.file_name().map_or("EA Game".to_string(), |f| f.to_string_lossy().to_string())
                            } else {
                                title
                            },
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

                        if let Ok(()) = queries::insert_or_update_game(conn, &game) {
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
    }
}
