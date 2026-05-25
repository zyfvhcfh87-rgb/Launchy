use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use chrono::Local;
use crate::models::game::GameArtwork;

pub fn get_artwork_dir() -> PathBuf {
    let mut path = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("Launchy");
    path.push("artwork");
    let _ = fs::create_dir_all(&path);
    path
}

pub fn get_game_artwork_dir(game_id: &str) -> PathBuf {
    let mut path = get_artwork_dir();
    path.push(game_id);
    let _ = fs::create_dir_all(&path);
    path
}

pub fn download_file(url: &str, destination: &Path) -> Result<(), String> {
    let response = reqwest::blocking::get(url)
        .map_err(|e| format!("Failed to send request: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Server returned error status: {}", response.status()));
    }

    let bytes = response.bytes().map_err(|e| format!("Failed to read body bytes: {}", e))?;
    let mut file = File::create(destination).map_err(|e| format!("Failed to create destination file: {}", e))?;
    file.write_all(&bytes).map_err(|e| format!("Failed to write to file: {}", e))?;

    Ok(())
}

pub fn fetch_steam_artwork(game_id: &str, app_id: &str) -> Option<GameArtwork> {
    let game_dir = get_game_artwork_dir(game_id);
    let cover_dest = game_dir.join("cover.jpg");
    let hero_dest = game_dir.join("hero.jpg");

    let mut has_changes = false;

    // 1. Download Cover (library_600x900) if it doesn't exist
    if !cover_dest.exists() {
        let cover_urls = vec![
            format!("https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/{}/library_600x900.jpg", app_id),
            format!("https://steamcdn-a.akamaihd.net/steam/apps/{}/library_600x900_2x.jpg", app_id),
            format!("https://steamcdn-a.akamaihd.net/steam/apps/{}/library_600x900.jpg", app_id),
            format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{}/library_600x900.jpg", app_id),
            format!("https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/{}/header.jpg", app_id),
            format!("https://steamcdn-a.akamaihd.net/steam/apps/{}/header.jpg", app_id),
            format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{}/header.jpg", app_id),
        ];

        let mut success = false;
        for url in &cover_urls {
            if download_file(url, &cover_dest).is_ok() {
                success = true;
                break;
            }
        }

        if success {
            has_changes = true;
        } else {
            println!("Failed to download Steam cover for app {} from any CDN candidate", app_id);
        }
    } else {
        has_changes = true; // Already exists
    }

    // 2. Download Hero (library_hero) if it doesn't exist
    if !hero_dest.exists() {
        let hero_urls = vec![
            format!("https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/{}/library_hero.jpg", app_id),
            format!("https://steamcdn-a.akamaihd.net/steam/apps/{}/library_hero.jpg", app_id),
            format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{}/library_hero.jpg", app_id),
            format!("https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/{}/header.jpg", app_id),
            format!("https://steamcdn-a.akamaihd.net/steam/apps/{}/header.jpg", app_id),
            format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{}/header.jpg", app_id),
        ];

        let mut success = false;
        for url in &hero_urls {
            if download_file(url, &hero_dest).is_ok() {
                success = true;
                break;
            }
        }

        if success {
            has_changes = true;
        } else {
            println!("Failed to download Steam hero for app {} from any CDN candidate", app_id);
        }
    } else {
        has_changes = true; // Already exists
    }

    if has_changes && (cover_dest.exists() || hero_dest.exists()) {
        Some(GameArtwork {
            game_id: game_id.to_string(),
            cover_path: if cover_dest.exists() { Some(cover_dest.to_string_lossy().to_string()) } else { None },
            hero_path: if hero_dest.exists() { Some(hero_dest.to_string_lossy().to_string()) } else { None },
            logo_path: None,
            icon_path: None,
            source: "steam_cdn".to_string(),
            updated_at: Local::now().to_rfc3339(),
        })
    } else {
        None
    }
}

pub fn trigger_artwork_fetch_background() {
    std::thread::spawn(|| {
        // Sleep briefly to let startup finish smoothly
        std::thread::sleep(std::time::Duration::from_millis(500));
        
        if let Ok(conn) = crate::db::establish_connection() {
            if let Ok(games) = crate::db::queries::get_all_games(&conn) {
                for game in games {
                    if game.source == "steam" {
                        if let Some(ref app_id) = game.source_app_id {
                            // Check if artwork already exists in DB
                            if game.artwork.is_none() {
                                if let Some(artwork) = fetch_steam_artwork(&game.id, app_id) {
                                    let _ = crate::db::queries::insert_or_update_artwork(&conn, &artwork);
                                    // Also update game's artwork_path for compatibility!
                                    if let Some(ref cover) = artwork.cover_path {
                                        let _ = crate::db::queries::update_artwork_path(&conn, &game.id, Some(cover.clone()));
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_artwork_dir() {
        let dir = get_artwork_dir();
        assert!(dir.exists());
        assert!(dir.is_dir());
        assert!(dir.to_string_lossy().contains("artwork"));
    }

    #[test]
    fn test_get_game_artwork_dir() {
        let game_id = "test_game_123";
        let dir = get_game_artwork_dir(game_id);
        assert!(dir.exists());
        assert!(dir.is_dir());
        assert!(dir.to_string_lossy().contains(game_id));

        // Cleanup
        let _ = fs::remove_dir_all(dir);
    }
}

