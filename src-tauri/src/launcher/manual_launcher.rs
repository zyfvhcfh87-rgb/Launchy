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

    let mut cmd = if let Some(ref r_type) = game.runner_type {
        if r_type == "wine" || r_type == "proton" {
            // Find custom runner or default to 'wine'
            let runner = game.runner_path.as_ref()
                .filter(|p| !p.trim().is_empty())
                .cloned()
                .unwrap_or_else(|| "wine".to_string());
            
            let mut c = Command::new(&runner);
            c.current_dir(install_path);
            
            // Set WINEPREFIX environment if specified
            if let Some(ref prefix) = game.runner_prefix {
                if !prefix.trim().is_empty() {
                    c.env("WINEPREFIX", prefix);
                }
            }
            
            // Pass the executable as the first argument to the runner
            c.arg(&full_path);
            c
        } else {
            let mut c = Command::new(&full_path);
            c.current_dir(install_path);
            c
        }
    } else {
        let mut c = Command::new(&full_path);
        c.current_dir(install_path);
        c
    };

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

