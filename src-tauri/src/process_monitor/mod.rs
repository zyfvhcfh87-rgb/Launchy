use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use sysinfo::System;
use crate::db::{queries, establish_connection};

#[derive(Debug, Clone, serde::Serialize)]
struct StatusPayload {
    game_id: String,
    status: String,
}

pub fn start_monitor(app_handle: AppHandle) {
    std::thread::spawn(move || {
        let mut sys = System::new_all();
        
        // Track games we believe are currently running
        // game_id -> (start_time, consecutive_missing_ticks)
        let running_sessions: Arc<Mutex<HashMap<String, (Instant, u32)>>> = Arc::new(Mutex::new(HashMap::new()));
        
        loop {
            std::thread::sleep(Duration::from_secs(3));
            
            let conn = match establish_connection() {
                Ok(c) => c,
                Err(_) => continue,
            };

            // Get all games
            let games = match queries::get_all_games(&conn) {
                Ok(g) => g,
                Err(_) => continue,
            };

            // Refresh system processes
            sys.refresh_processes();
            
            // Collect all active running process details
            let mut active_processes = Vec::new();
            for (_pid, process) in sys.processes() {
                let name = process.name().to_string();
                let path = process.exe().map(|p| p.to_string_lossy().to_string()).unwrap_or_default();
                active_processes.push((name, path));
            }

            let mut sessions = running_sessions.lock().unwrap();

            for game in &games {
                // We only monitor games that have an installation path
                let install_path = match &game.install_path {
                    Some(path) if !path.is_empty() => path,
                    _ => continue,
                };

                // Check if any process matches this game
                let is_running = active_processes.iter().any(|(name, path)| {
                    // Rule 1: The process executable is located inside the game's install path (strongest match)
                    let matches_path = !path.is_empty() && path.to_lowercase().starts_with(&install_path.to_lowercase());

                    // Rule 2: If we have an expected launch executable, match by name
                    let matches_exe = if let Some(ref launch_exe) = game.launch_exe {
                        name.to_lowercase() == launch_exe.to_lowercase()
                    } else {
                        false
                    };

                    matches_path || matches_exe
                });

                if is_running {
                    // If the game was not previously registered as running, transition it!
                    if !sessions.contains_key(&game.id) {
                        sessions.insert(game.id.clone(), (Instant::now(), 0));
                        
                        // Update DB to 'running'
                        let _ = queries::update_status(&conn, &game.id, "running");
                        
                        // Emit live tauri event
                        let _ = app_handle.emit(
                            "game-status-changed",
                            StatusPayload {
                                game_id: game.id.clone(),
                                status: "running".to_string(),
                            },
                        );
                    } else {
                        // Reset the consecutive missing ticks if it's found running again
                        if let Some(session) = sessions.get_mut(&game.id) {
                            session.1 = 0;
                        }
                        
                        // Safety: Make sure the state in DB is actually 'running'
                        if game.status != "running" {
                            let _ = queries::update_status(&conn, &game.id, "running");
                        }
                    }
                } else {
                    // Game is NOT running currently. Check if we were tracking it.
                    if sessions.contains_key(&game.id) {
                        let should_terminate = {
                            let session = sessions.get_mut(&game.id).unwrap();
                            session.1 += 1; // Increment missing ticks
                            
                            // Require 3 consecutive missing checks (approx 9 seconds) before closing
                            session.1 >= 3
                        };

                        if should_terminate {
                            if let Some((start_time, _)) = sessions.remove(&game.id) {
                                // Calculate playtime increment
                                let elapsed = start_time.elapsed().as_secs() as i32;
                                let now_str = chrono::Local::now().to_rfc3339();
                                
                                // Update DB (playtime & status reset to 'installed')
                                let _ = queries::update_playtime_and_last_played(&conn, &game.id, elapsed, &now_str);
                                let _ = queries::update_status(&conn, &game.id, "installed");
                                
                                // Emit closure event
                                let _ = app_handle.emit(
                                    "game-status-changed",
                                    StatusPayload {
                                        game_id: game.id.clone(),
                                        status: "installed".to_string(),
                                    },
                                );
                            }
                        }
                    }
                }
            }
        }
    });
}
