use std::fs;
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};
use crate::db::queries;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginManifest {
    pub id: String,
    pub name: String,
    pub description: String,
    pub version: String,
    pub author: String,
    pub entry: String,
    pub plugin_type: String, // metadata_scraper, library_connector, stats_parser, etc.
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginInfo {
    pub manifest: PluginManifest,
    pub path: String,
    pub enabled: bool,
}

fn get_plugins_dir() -> Option<PathBuf> {
    let base = dirs::data_dir()?;
    let path = base.join("Launchy").join("plugins");
    if !path.exists() {
        let _ = fs::create_dir_all(&path);
    }
    Some(path)
}

pub fn list_plugins(conn: &rusqlite::Connection) -> Result<Vec<PluginInfo>, String> {
    let plugins_dir = get_plugins_dir().ok_or_else(|| "Failed to resolve app data directory".to_string())?;
    let mut plugins = Vec::new();

    if let Ok(entries) = fs::read_dir(plugins_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let manifest_path = path.join("manifest.json");
                if manifest_path.exists() && manifest_path.is_file() {
                    if let Ok(content) = fs::read_to_string(&manifest_path) {
                        if let Ok(manifest) = serde_json::from_str::<PluginManifest>(&content) {
                            // Check active enabled state in SQLite settings
                            let enabled_key = format!("plugin_enabled_{}", manifest.id);
                            let enabled_val = queries::get_setting(conn, &enabled_key).unwrap_or(None);
                            // Default to true for new plugins
                            let enabled = enabled_val.map(|v| v == "true").unwrap_or(true);

                            plugins.push(PluginInfo {
                                manifest,
                                path: path.to_string_lossy().to_string(),
                                enabled,
                            });
                        }
                    }
                }
            }
        }
    }

    Ok(plugins)
}

pub fn toggle_plugin(conn: &rusqlite::Connection, id: &str, enabled: bool) -> Result<(), String> {
    let enabled_key = format!("plugin_enabled_{}", id);
    queries::set_setting(conn, &enabled_key, if enabled { "true" } else { "false" })
        .map_err(|e| e.to_string())
}

pub fn execute_plugin(
    conn: &rusqlite::Connection,
    id: &str,
    event: &str,
    payload: Option<&str>,
) -> Result<String, String> {
    let plugins = list_plugins(conn)?;
    let plugin = plugins.iter().find(|p| p.manifest.id == id)
        .ok_or_else(|| "Plugin not found".to_string())?;

    if !plugin.enabled {
        return Err("Plugin is disabled".to_string());
    }

    let plugin_path = Path::new(&plugin.path);
    let entry_script = plugin_path.join(&plugin.manifest.entry);

    if !entry_script.exists() {
        return Err(format!("Plugin entry script not found: {:?}", entry_script));
    }

    let script_str = entry_script.to_string_lossy().to_string();
    let payload_str = payload.unwrap_or("");

    // Determine binary interpreter based on file extension
    let ext = entry_script.extension().and_then(|e| e.to_str()).unwrap_or("");
    let mut cmd = if ext == "py" {
        let mut c = std::process::Command::new("python");
        c.arg(&script_str);
        c
    } else if ext == "js" {
        let mut c = std::process::Command::new("node");
        c.arg(&script_str);
        c
    } else {
        return Err(format!("Unsupported script extension: .{}", ext));
    };

    // Set execution arguments: <event> <payload>
    cmd.arg(event).arg(payload_str);
    cmd.current_dir(plugin_path);

    let output = cmd.output()
        .map_err(|e| format!("Failed to spawn plugin subprocess: {}. Ensure python/node is on your system PATH.", e))?;

    if !output.status.success() {
        let err_msg = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(format!("Plugin execution failed: {}", err_msg));
    }

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    Ok(stdout.trim().to_string())
}

pub fn create_sample_plugins() -> Result<(), String> {
    let plugins_dir = get_plugins_dir().ok_or_else(|| "Failed to resolve app data directory".to_string())?;
    
    // 1. Python Scraper Plugin
    let py_dir = plugins_dir.join("sample_python_scraper");
    let _ = fs::create_dir_all(&py_dir);

    let py_manifest = PluginManifest {
        id: "sample_python_scraper".to_string(),
        name: "Python Metadata Scraper".to_string(),
        description: "Scrapes custom metadata summaries using Python.".to_string(),
        version: "1.0.0".to_string(),
        author: "Launchy Team".to_string(),
        entry: "main.py".to_string(),
        plugin_type: "metadata_scraper".to_string(),
    };

    let _ = fs::write(
        py_dir.join("manifest.json"),
        serde_json::to_string_pretty(&py_manifest).unwrap()
    );

    let py_code = r#"import sys
import json

def scrape_meta(game_title):
    # Mock lookup representing a custom web or local scraper
    lower_title = game_title.lower()
    
    if "witcher" in lower_title:
        return {
            "description": "The Witcher is a story-driven, next-generation open world role-playing game set in a visually stunning fantasy universe.",
            "genres": "RPG, Action, Fantasy",
            "developer": "CD PROJEKT RED",
            "release_date": "2015-05-19"
        }
    elif "hollow" in lower_title:
        return {
            "description": "Forge your own path in Hollow Knight! An epic action adventure through a vast ruined kingdom of insects and heroes.",
            "genres": "Metroidvania, Indie, Action",
            "developer": "Team Cherry",
            "release_date": "2017-02-24"
        }
    else:
        return {
            "description": f"Custom metadata scraped for {game_title} using Launchy Python connector.",
            "genres": "Indie, Custom",
            "developer": "Community Contributor"
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No arguments provided"}))
        sys.exit(1)
        
    event = sys.argv[1]
    payload = sys.argv[2] if len(sys.argv) > 2 else ""

    if event == "scrape":
        # Payload holds the game title
        res = scrape_meta(payload)
        print(json.dumps(res))
    else:
        print(json.dumps({"status": "unknown_event", "received_payload": payload}))
"#;
    let _ = fs::write(py_dir.join("main.py"), py_code);

    // 2. JavaScript Integration Plugin
    let js_dir = plugins_dir.join("sample_javascript_connector");
    let _ = fs::create_dir_all(&js_dir);

    let js_manifest = PluginManifest {
        id: "sample_javascript_connector".to_string(),
        name: "JavaScript Library Connector".to_string(),
        description: "Imports mock DRM-free indie games list using Node.js.".to_string(),
        version: "1.0.0".to_string(),
        author: "Launchy Team".to_string(),
        entry: "main.js".to_string(),
        plugin_type: "library_connector".to_string(),
    };

    let _ = fs::write(
        js_dir.join("manifest.json"),
        serde_json::to_string_pretty(&js_manifest).unwrap()
    );

    let js_code = r#"const sys = require('sys');

function scanLibrary() {
    // Returns a mock list representing custom itch/drm-free directories
    return [
        {
            "id": "manual_plugin_doom",
            "title": "Doom (1993) Classic",
            "source": "manual",
            "install_path": "C:\\Games\\Doom",
            "launch_method": "exec",
            "launch_exe": "DOOM.EXE",
            "status": "installed"
        },
        {
            "id": "manual_plugin_quake",
            "title": "Quake Remastered",
            "source": "manual",
            "install_path": "C:\\Games\\Quake",
            "launch_method": "exec",
            "launch_exe": "quake.exe",
            "status": "installed"
        }
    ];
}

const args = process.argv.slice(2);
if (args.length === 0) {
    console.log(JSON.stringify({ error: "No arguments provided" }));
    process.exit(1);
}

const event = args[0];
const payload = args[1] || "";

if (event === "scan") {
    const list = scanLibrary();
    console.log(JSON.stringify(list));
} else {
    console.log(JSON.stringify({ status: "success", received: event, payload: payload }));
}
"#;
    let _ = fs::write(js_dir.join("main.js"), js_code);

    Ok(())
}
