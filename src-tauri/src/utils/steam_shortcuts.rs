use std::collections::BTreeMap;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::Path;
use crate::models::game::Game;
use crate::db::queries;

#[derive(Debug, Clone)]
enum VdfValue {
    Str(String),
    Int(i32),
    Tags(BTreeMap<String, String>),
    SubMap(BTreeMap<String, VdfValue>),
}

// Byte-level binary VDF parser
fn parse_binary_vdf(data: &[u8], pos: &mut usize) -> Result<BTreeMap<String, VdfValue>, String> {
    let mut map = BTreeMap::new();

    while *pos < data.len() {
        let type_byte = data[*pos];
        *pos += 1;

        if type_byte == 0x08 {
            // End of current dictionary container
            return Ok(map);
        }

        // Read null-terminated string key
        let mut key_bytes = Vec::new();
        while *pos < data.len() && data[*pos] != 0x00 {
            key_bytes.push(data[*pos]);
            *pos += 1;
        }
        *pos += 1; // skip null byte

        let key = String::from_utf8_lossy(&key_bytes).to_string();

        match type_byte {
            0x00 => {
                // Nested dictionary
                let nested = parse_binary_vdf(data, pos)?;
                if key == "tags" {
                    let mut tags_map = BTreeMap::new();
                    for (k, val) in nested {
                        if let VdfValue::Str(s) = val {
                            tags_map.insert(k, s);
                        }
                    }
                    map.insert(key, VdfValue::Tags(tags_map));
                } else {
                    map.insert(key, VdfValue::SubMap(nested));
                }
            }
            0x01 => {
                // Null-terminated string value
                let mut val_bytes = Vec::new();
                while *pos < data.len() && data[*pos] != 0x00 {
                    val_bytes.push(data[*pos]);
                    *pos += 1;
                }
                *pos += 1; // skip null byte
                let val = String::from_utf8_lossy(&val_bytes).to_string();
                map.insert(key, VdfValue::Str(val));
            }
            0x02 => {
                // 32-bit integer (little endian)
                if *pos + 4 <= data.len() {
                    let val = i32::from_le_bytes([
                        data[*pos],
                        data[*pos + 1],
                        data[*pos + 2],
                        data[*pos + 3]
                    ]);
                    *pos += 4;
                    map.insert(key, VdfValue::Int(val));
                } else {
                    return Err("Malformed VDF integer payload".to_string());
                }
            }
            _ => return Err(format!("Unknown VDF type byte: 0x{:02x}", type_byte)),
        }
    }

    Ok(map)
}

fn serialize_value(data: &mut Vec<u8>, key: &str, val: &VdfValue) {
    match val {
        VdfValue::Str(s) => {
            data.push(0x01);
            data.extend_from_slice(key.as_bytes());
            data.push(0x00);
            data.extend_from_slice(s.as_bytes());
            data.push(0x00);
        }
        VdfValue::Int(i) => {
            data.push(0x02);
            data.extend_from_slice(key.as_bytes());
            data.push(0x00);
            data.extend_from_slice(&i.to_le_bytes());
        }
        VdfValue::Tags(tags) => {
            data.push(0x00);
            data.extend_from_slice(key.as_bytes());
            data.push(0x00);
            for (tag_idx, tag_val) in tags {
                data.push(0x01);
                data.extend_from_slice(tag_idx.as_bytes());
                data.push(0x00);
                data.extend_from_slice(tag_val.as_bytes());
                data.push(0x00);
            }
            data.push(0x08);
        }
        VdfValue::SubMap(sub) => {
            data.push(0x00);
            data.extend_from_slice(key.as_bytes());
            data.push(0x00);
            for (sub_k, sub_v) in sub {
                serialize_value(data, sub_k, sub_v);
            }
            data.push(0x08);
        }
    }
}

// Binary VDF serializer
fn serialize_binary_vdf(shortcuts: &[BTreeMap<String, VdfValue>]) -> Vec<u8> {
    let mut data = Vec::new();

    // Start outer 'shortcuts' dictionary
    data.push(0x00);
    data.extend_from_slice(b"shortcuts\0");

    for (index, shortcut) in shortcuts.iter().enumerate() {
        // Start shortcut item dictionary (key is index as a string)
        data.push(0x00);
        data.extend_from_slice(index.to_string().as_bytes());
        data.push(0x00);

        for (key, val) in shortcut {
            serialize_value(&mut data, key, val);
        }

        data.push(0x08); // Close shortcut item dictionary
    }

    data.push(0x08); // Close outer 'shortcuts' dictionary
    data
}

// Calculate simple deterministic integer hash for appid
fn calculate_shortcut_appid(title: &str, exe: &str) -> i32 {
    let combined = format!("{}{}", exe, title);
    let mut hash = 0u32;
    for byte in combined.bytes() {
        hash = hash.wrapping_add(byte as u32);
        hash = hash.wrapping_mul(31);
    }
    // Return positive signed i32 representation
    (hash & 0x7FFFFFFF) as i32
}

pub fn sideload_manual_games_to_steam() -> Result<(), String> {
    let conn = crate::db::establish_connection().map_err(|e| e.to_string())?;
    
    // Load manually registered games from SQLite
    let all_games = queries::get_all_games(&conn).map_err(|e| e.to_string())?;
    let manual_games: Vec<Game> = all_games.into_iter()
        .filter(|g| g.source == "manual")
        .collect();

    if manual_games.is_empty() {
        return Ok(()); // Nothing to sideload
    }

    // Locate Steam path
    let steam_path = match crate::scanners::steam::detect_steam_root() {
        Some(p) => p,
        None => return Err("Steam installation not found on this machine".to_string()),
    };

    let userdata_path = steam_path.join("userdata");
    if !userdata_path.exists() {
        return Err("Steam userdata folder not found. Please launch Steam once first.".to_string());
    }

    // Scan all Steam user profiles under userdata
    if let Ok(entries) = fs::read_dir(userdata_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let user_config_dir = path.join("config");
                let shortcuts_vdf_path = user_config_dir.join("shortcuts.vdf");

                // Safely load existing shortcuts
                let mut existing_shortcuts = Vec::new();
                if shortcuts_vdf_path.exists() {
                    if let Ok(mut file) = File::open(&shortcuts_vdf_path) {
                        let mut buffer = Vec::new();
                        if file.read_to_end(&mut buffer).is_ok() && buffer.len() > 10 {
                            let mut pos = 0;
                            // Outer shortcuts map name
                            if buffer[pos] == 0x00 {
                                pos += 1;
                                // Skip "shortcuts\0" header key
                                while pos < buffer.len() && buffer[pos] != 0x00 { pos += 1; }
                                pos += 1;

                                // Parse list of shortcuts
                                if let Ok(shortcuts_map) = parse_binary_vdf(&buffer, &mut pos) {
                                    for (_idx, val) in shortcuts_map {
                                        if let VdfValue::SubMap(nested) = val {
                                            existing_shortcuts.push(nested);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // Sideload each Launchy manual game
                for game in &manual_games {
                    let exe_dir = game.install_path.as_ref().cloned().unwrap_or_default();
                    let exe_name = game.launch_exe.as_ref().cloned().unwrap_or_default();
                    
                    if exe_dir.is_empty() || exe_name.is_empty() {
                        continue;
                    }

                    let full_exe_path = Path::new(&exe_dir).join(&exe_name);
                    let full_exe_str = format!("\"{}\"", full_exe_path.to_string_lossy());
                    let start_dir_str = format!("\"{}\"", exe_dir);

                    // Check if already registered (match by AppName)
                    let mut found = false;
                    for shortcut in &mut existing_shortcuts {
                        if let Some(VdfValue::Str(name)) = shortcut.get("AppName") {
                            if name.to_lowercase() == game.title.to_lowercase() {
                                // Update existing shortcut fields
                                shortcut.insert("Exe".to_string(), VdfValue::Str(full_exe_str.clone()));
                                shortcut.insert("StartDir".to_string(), VdfValue::Str(start_dir_str.clone()));
                                if let Some(ref args) = game.launch_args {
                                    shortcut.insert("LaunchOptions".to_string(), VdfValue::Str(args.clone()));
                                }
                                if let Some(ref art) = game.artwork_path {
                                    shortcut.insert("icon".to_string(), VdfValue::Str(art.clone()));
                                }
                                found = true;
                                break;
                            }
                        }
                    }

                    if !found {
                        // Append a brand new shortcut
                        let appid = calculate_shortcut_appid(&game.title, &full_exe_str);
                        let mut new_shortcut = BTreeMap::new();
                        new_shortcut.insert("appid".to_string(), VdfValue::Int(appid));
                        new_shortcut.insert("AppName".to_string(), VdfValue::Str(game.title.clone()));
                        new_shortcut.insert("Exe".to_string(), VdfValue::Str(full_exe_str));
                        new_shortcut.insert("StartDir".to_string(), VdfValue::Str(start_dir_str));
                        new_shortcut.insert("icon".to_string(), VdfValue::Str(game.artwork_path.clone().unwrap_or_default()));
                        new_shortcut.insert("ShortcutPath".to_string(), VdfValue::Str("".to_string()));
                        new_shortcut.insert("LaunchOptions".to_string(), VdfValue::Str(game.launch_args.clone().unwrap_or_default()));
                        new_shortcut.insert("IsShortcut".to_string(), VdfValue::Int(1));
                        new_shortcut.insert("AllowDesktopConfig".to_string(), VdfValue::Int(1));
                        new_shortcut.insert("AllowOverlay".to_string(), VdfValue::Int(1));
                        new_shortcut.insert("OpenVR".to_string(), VdfValue::Int(0));
                        new_shortcut.insert("Devkit".to_string(), VdfValue::Int(0));
                        new_shortcut.insert("DevkitGameID".to_string(), VdfValue::Str("".to_string()));
                        new_shortcut.insert("LastPlayTime".to_string(), VdfValue::Int(0));
                        new_shortcut.insert("tags".to_string(), VdfValue::Tags(BTreeMap::new()));
                        
                        existing_shortcuts.push(new_shortcut);
                    }
                }

                // Create backup file shortcuts.vdf.bak first
                if shortcuts_vdf_path.exists() {
                    let backup_path = user_config_dir.join("shortcuts.vdf.bak");
                    let _ = fs::copy(&shortcuts_vdf_path, &backup_path);
                } else {
                    // Ensure the config directory exists
                    let _ = fs::create_dir_all(&user_config_dir);
                }

                // Serialize and write back
                let binary_payload = serialize_binary_vdf(&existing_shortcuts);
                if let Ok(mut outfile) = File::create(&shortcuts_vdf_path) {
                    let _ = outfile.write_all(&binary_payload);
                }
            }
        }
    }

    Ok(())
}
