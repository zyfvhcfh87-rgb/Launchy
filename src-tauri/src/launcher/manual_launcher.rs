use crate::models::game::Game;
use std::process::Command;
use std::path::Path;

pub fn launch(game: &Game) -> Result<(), String> {
    let install_path = game.install_path.as_ref()
        .ok_or_else(|| "Install path is missing for manual game".to_string())?;

    let exe_name = game.launch_exe.as_ref()
        .ok_or_else(|| "Launch executable is missing for manual game".to_string())?;

    let full_path = Path::new(install_path).join(exe_name);
    if !full_path.exists() {
        return Err(format!("Executable not found at: {:?}", full_path));
    }

    let mut cmd = Command::new(&full_path);
    cmd.current_dir(install_path);

    if let Some(ref args) = game.launch_args {
        // Simple whitespace split for arguments
        for arg in args.split_whitespace() {
            cmd.arg(arg);
        }
    }

    // Spawn the process asynchronously
    cmd.spawn()
        .map_err(|e| format!("Failed to spawn standalone executable: {}", e))?;

    Ok(())
}
