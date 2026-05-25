use rusqlite::Connection;
use crate::models::game::{Game, ProcessSignature};
use crate::db::queries;
use std::path::Path;

pub fn add_manual_game(
    conn: &Connection,
    title: String,
    exe_path: String,
    args: Option<String>,
    artwork_path: Option<String>,
) -> Result<Game, String> {
    let path = Path::new(&exe_path);
    let install_dir = path.parent().map(|p| p.to_string_lossy().to_string());
    let exe_name = path.file_name().map(|f| f.to_string_lossy().to_string());

    if exe_name.is_none() {
        return Err("Invalid executable path".to_string());
    }

    let exe_name = exe_name.unwrap();
    let now = chrono::Local::now().to_rfc3339();
    let game_id = format!("manual_{}", chrono::Local::now().timestamp_millis());

    let game = Game {
        id: game_id.clone(),
        source: "manual".to_string(),
        source_app_id: None,
        title,
        install_path: install_dir.clone(),
        launch_method: "exec".to_string(),
        launch_uri: None,
        launch_exe: Some(exe_name.clone()),
        launch_args: args,
        artwork_path,
        status: if path.exists() { "installed".to_string() } else { "missing".to_string() },
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

    queries::insert_or_update_game(conn, &game)
        .map_err(|e| format!("Failed to insert game: {}", e))?;

    // Create process signature
    let sig = ProcessSignature {
        id: format!("sig_{}", game_id),
        game_id,
        exe_name: Some(exe_name),
        exe_path: install_dir,
        confidence: 100,
        last_seen_pid: None,
        created_at: chrono::Local::now().to_rfc3339(),
        updated_at: chrono::Local::now().to_rfc3339(),
    };

    let _ = queries::insert_or_update_signature(conn, &sig);

    Ok(game)
}
