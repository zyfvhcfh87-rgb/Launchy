use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};
use std::sync::atomic::Ordering;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use sysinfo::System;
use crate::db::{queries, establish_connection};

#[derive(Debug, Clone, serde::Serialize)]
struct StatusPayload {
    game_id: String,
    status: String,
}

// Trace active processes upwards using parent PIDs to check for ancestral root PID linkage
fn is_descendant(
    mut current_parent: Option<sysinfo::Pid>,
    root_pids: &[sysinfo::Pid],
    active_processes: &[(sysinfo::Pid, String, String, Option<sysinfo::Pid>)],
) -> bool {
    let mut visited = HashSet::new();
    while let Some(parent) = current_parent {
        if root_pids.contains(&parent) {
            return true;
        }
        if !visited.insert(parent) {
            break; // Stop infinite circular traversal loops
        }
        
        // Find parent's parent from active processes list
        let next_parent = active_processes.iter()
            .find(|(pid, _, _, _)| *pid == parent)
            .and_then(|(_, _, _, p_parent)| *p_parent);
        current_parent = next_parent;
    }
    false
}

pub fn start_monitor(app_handle: AppHandle) {
    std::thread::spawn(move || {
        let mut sys = System::new_all();
        
        // Track games currently running
        // game_id -> (start_time, consecutive_missing_ticks, tracked_root_pids)
        let running_sessions: Arc<Mutex<HashMap<String, (Instant, u32, Vec<sysinfo::Pid>)>>> = Arc::new(Mutex::new(HashMap::new()));
        
        loop {
            std::thread::sleep(Duration::from_secs(3));

            // Pause ticks safely if the import backup wizard is currently running
            if crate::utils::backup::IS_RESTORING.load(Ordering::SeqCst) {
                continue;
            }
            
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
            for (pid, process) in sys.processes() {
                let name = process.name().to_string();
                let path = process.exe().map(|p| p.to_string_lossy().to_string()).unwrap_or_default();
                let parent_pid = process.parent();
                active_processes.push((*pid, name, path, parent_pid));
            }

            let mut sessions = running_sessions.lock().unwrap();

            for game in &games {
                // We only monitor games that have an installation path
                let install_path = match &game.install_path {
                    Some(path) if !path.is_empty() => path,
                    _ => continue,
                };

                // Check direct matching rules to discover newly spawned PIDs
                let mut direct_matched_pids = Vec::new();
                for (pid, name, path, _parent) in &active_processes {
                    let matches_path = !path.is_empty() && path.to_lowercase().starts_with(&install_path.to_lowercase());
                    let matches_exe = if let Some(ref launch_exe) = game.launch_exe {
                        name.to_lowercase() == launch_exe.to_lowercase()
                    } else {
                        false
                    };

                    if matches_path || matches_exe {
                        direct_matched_pids.push(*pid);
                    }
                }

                // Check if the game is active based on direct matches OR active descendants tree
                let mut is_active = !direct_matched_pids.is_empty();

                if let Some(session) = sessions.get_mut(&game.id) {
                    // Update our root PIDs list with any new direct matches discovered
                    for pid in &direct_matched_pids {
                        if !session.2.contains(pid) {
                            session.2.push(*pid);
                        }
                    }

                    // If no direct matches are active, crawl process tree for existing tracked roots descendants
                    if !is_active && !session.2.is_empty() {
                        for (pid, _name, _path, parent) in &active_processes {
                            if session.2.contains(pid) || is_descendant(*parent, &session.2, &active_processes) {
                                is_active = true;
                                break;
                            }
                        }
                    }
                }

                if is_active {
                    // If the game was not previously registered as running, transition it!
                    if !sessions.contains_key(&game.id) {
                        sessions.insert(game.id.clone(), (Instant::now(), 0, direct_matched_pids));
                        
                        // Update DB to 'running'
                        let _ = queries::update_status(&conn, &game.id, "running");
                        
                        // Update Discord Rich Presence if enabled
                        let discord_enabled = queries::get_setting(&conn, "discord_presence_enabled")
                            .unwrap_or(None)
                            .map(|v| v == "true")
                            .unwrap_or(false);

                        if discord_enabled {
                            let _ = crate::discord_rpc::set_activity(&game.title, 0);
                        }

                        // Emit live tauri event
                        let _ = app_handle.emit(
                            "game-status-changed",
                            StatusPayload {
                                game_id: game.id.clone(),
                                status: "running".to_string(),
                            },
                        );
                    } else {
                        // Reset consecutive missing ticks if still active
                        if let Some(session) = sessions.get_mut(&game.id) {
                            session.1 = 0;
                        }
                        
                        // Safety: Make sure the state in DB matches
                        if game.status != "running" {
                            let _ = queries::update_status(&conn, &game.id, "running");
                        }
                    }
                } else {
                    // Game is NOT running. Check if we were tracking it.
                    if sessions.contains_key(&game.id) {
                        let should_terminate = {
                            let session = sessions.get_mut(&game.id).unwrap();
                            session.1 += 1; // Increment missing ticks
                            
                            // Require 3 consecutive missing checks (approx 9 seconds) before closing
                            session.1 >= 3
                        };

                        if should_terminate {
                            if let Some((start_time, _, _)) = sessions.remove(&game.id) {
                                // Calculate playtime increment
                                let elapsed = start_time.elapsed().as_secs() as i32;
                                let now_str = chrono::Local::now().to_rfc3339();
                                
                                // Update DB (playtime & status reset to 'installed')
                                let _ = queries::update_playtime_and_last_played(&conn, &game.id, elapsed, &now_str);
                                let _ = queries::insert_playtime_session(&conn, &game.id, elapsed, &now_str);
                                let _ = queries::update_status(&conn, &game.id, "installed");
                                
                                // Clear Discord Rich Presence
                                let _ = crate::discord_rpc::clear_activity();

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
