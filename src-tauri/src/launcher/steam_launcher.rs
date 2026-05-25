use crate::models::game::Game;

pub fn launch(game: &Game) -> Result<(), String> {
    let launch_uri = game.launch_uri.as_ref()
        .ok_or_else(|| "Launch URI is missing for Steam game".to_string())?;

    // Natively open Steam protocol URL
    open::that(launch_uri)
        .map_err(|e| format!("Failed to open Steam launch URI: {}", e))?;

    Ok(())
}
