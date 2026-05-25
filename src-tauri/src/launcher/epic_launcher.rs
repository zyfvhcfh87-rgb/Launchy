use crate::models::game::Game;

pub fn launch(game: &Game) -> Result<(), String> {
    let launch_uri = game.launch_uri.as_ref()
        .ok_or_else(|| "Launch URI is missing for Epic game".to_string())?;

    // Safely open the Epic Launcher launch URI protocol
    open::that(launch_uri)
        .map_err(|e| {
            // Fallback: If launcher protocol fails, try opening standard Epic Launcher URL or prompt
            format!(
                "Epic Games Launcher failed to handle launch. Is Epic Games Launcher installed? Error: {}",
                e
            )
        })?;

    Ok(())
}
