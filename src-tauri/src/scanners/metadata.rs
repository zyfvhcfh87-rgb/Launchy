use chrono::{Local, TimeZone, Utc};
use serde::Deserialize;
use rusqlite::Connection;
use crate::db::{queries, establish_connection};
use crate::models::game::{Game, GameArtwork};
use crate::scanners::artwork::{get_game_artwork_dir, download_file};

// --- SteamGridDB Structs ---
#[derive(Debug, Deserialize)]
struct SgdbResponse<T> {
    success: bool,
    data: Option<T>,
    errors: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
struct SgdbGame {
    id: u32,
    name: String,
}

#[derive(Debug, Deserialize)]
struct SgdbAsset {
    id: u32,
    url: String,
}

// --- IGDB Structs ---
#[derive(Debug, Deserialize)]
struct TwitchTokenResponse {
    access_token: String,
    expires_in: u64,
}

#[derive(Debug, Deserialize)]
struct IgdbGenre {
    name: String,
}

#[derive(Debug, Deserialize)]
struct IgdbCompany {
    name: String,
}

#[derive(Debug, Deserialize)]
struct IgdbInvolvedCompany {
    company: IgdbCompany,
    developer: bool,
}

#[derive(Debug, Deserialize)]
struct IgdbAgeRating {
    category: i32, // 1 is ESRB
    rating: i32,   // rating value
}

#[derive(Debug, Deserialize)]
struct IgdbGameResult {
    name: String,
    summary: Option<String>,
    first_release_date: Option<i64>,
    genres: Option<Vec<IgdbGenre>>,
    involved_companies: Option<Vec<IgdbInvolvedCompany>>,
    age_ratings: Option<Vec<IgdbAgeRating>>,
}

// --- Helper Functions ---
fn get_twitch_access_token(conn: &Connection, client_id: &str, client_secret: &str) -> Result<String, String> {
    // Check if we have a valid cached token
    let cached_token = queries::get_setting(conn, "igdb_access_token").unwrap_or(None);
    let cached_expires = queries::get_setting(conn, "igdb_token_expires").unwrap_or(None);

    if let (Some(token), Some(expires_str)) = (cached_token, cached_expires) {
        if let Ok(expires_timestamp) = expires_str.parse::<i64>() {
            let now = Utc::now().timestamp();
            if now < expires_timestamp {
                return Ok(token);
            }
        }
    }

    // Cache missing or expired, request a new one
    let url = format!(
        "https://id.twitch.tv/oauth2/token?client_id={}&client_secret={}&grant_type=client_credentials",
        client_id, client_secret
    );

    let client = reqwest::blocking::Client::new();
    let response = client.post(&url)
        .send()
        .map_err(|e| format!("Failed to send Twitch token request: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Twitch token server returned status: {}", response.status()));
    }

    let token_data: TwitchTokenResponse = response.json()
        .map_err(|e| format!("Failed to parse Twitch token response: {}", e))?;

    // Cache new token
    let now = Utc::now().timestamp();
    let buffer_seconds = 60; // 1-minute buffer safety
    let expires_timestamp = now + token_data.expires_in as i64 - buffer_seconds;

    let _ = queries::set_setting(conn, "igdb_access_token", &token_data.access_token);
    let _ = queries::set_setting(conn, "igdb_token_expires", &expires_timestamp.to_string());

    Ok(token_data.access_token)
}

fn parse_esrb_rating(rating: i32) -> &'static str {
    match rating {
        6 => "RP (Rating Pending)",
        7 => "EC (Early Childhood)",
        8 => "E (Everyone)",
        9 => "E10+ (Everyone 10+)",
        10 => "T (Teen)",
        11 => "M (Mature)",
        12 => "AO (Adults Only)",
        _ => "RP",
    }
}

// --- Main Scrapers Implementation ---

pub fn fetch_and_save_metadata(game_id: &str) -> Result<Game, String> {
    let conn = establish_connection().map_err(|e| e.to_string())?;
    let mut game = queries::get_game_by_id(&conn, game_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Game not found in library".to_string())?;

    // 1. Fetch & Save IGDB Details
    let igdb_client_id = queries::get_setting(&conn, "igdb_client_id").unwrap_or(None);
    let igdb_client_secret = queries::get_setting(&conn, "igdb_client_secret").unwrap_or(None);

    if let (Some(client_id), Some(client_secret)) = (igdb_client_id, igdb_client_secret) {
        if !client_id.trim().is_empty() && !client_secret.trim().is_empty() {
            match get_twitch_access_token(&conn, &client_id, &client_secret) {
                Ok(token) => {
                    let client = reqwest::blocking::Client::new();
                    // IGDB queries require a POST request with the query body in the text payload
                    let query = format!(
                        "search \"{}\"; fields name, summary, first_release_date, genres.name, involved_companies.company.name, involved_companies.developer, age_ratings.rating, age_ratings.category; limit 1;",
                        game.title.replace("\"", "\\\"")
                    );

                    let response = client.post("https://api.igdb.com/v4/games")
                        .header("Client-ID", &client_id)
                        .header("Authorization", format!("Bearer {}", token))
                        .body(query)
                        .send();

                    match response {
                        Ok(res) if res.status().is_success() => {
                            if let Ok(mut results) = res.json::<Vec<IgdbGameResult>>() {
                                if !results.is_empty() {
                                    let result = results.remove(0);
                                    
                                    // Map description
                                    game.description = result.summary;

                                    // Map release date
                                    game.release_date = result.first_release_date.map(|timestamp| {
                                        if let Some(date_time) = Utc.timestamp_opt(timestamp, 0).single() {
                                            date_time.format("%Y-%m-%d").to_string()
                                        } else {
                                            "".to_string()
                                        }
                                    });

                                    // Map genres
                                    game.genres = result.genres.map(|g_list| {
                                        g_list.iter()
                                            .map(|g| g.name.clone())
                                            .collect::<Vec<String>>()
                                            .join(", ")
                                    });

                                    // Map developer
                                    game.developer = result.involved_companies.map(|c_list| {
                                        c_list.iter()
                                            .filter(|c| c.developer)
                                            .map(|c| c.company.name.clone())
                                            .collect::<Vec<String>>()
                                            .join(", ")
                                    });

                                    // Map ESRB rating
                                    game.esrb_rating = result.age_ratings.map(|ratings| {
                                        ratings.iter()
                                            .filter(|r| r.category == 1) // 1 = ESRB
                                            .map(|r| parse_esrb_rating(r.rating).to_string())
                                            .next()
                                            .unwrap_or_else(|| "".to_string())
                                    });
                                }
                            }
                        }
                        Ok(res) => println!("IGDB returned error status: {}", res.status()),
                        Err(e) => println!("IGDB request failed: {}", e),
                    }
                }
                Err(e) => println!("Twitch OAuth flow failed: {}", e),
            }
        }
    }

    // 2. Fetch & Save SteamGridDB Artwork
    let sgdb_api_key = queries::get_setting(&conn, "steamgrid_api_key").unwrap_or(None);
    if let Some(api_key) = sgdb_api_key {
        if !api_key.trim().is_empty() {
            let client = reqwest::blocking::Client::new();
            let auth_header = format!("Bearer {}", api_key.trim());

            // Step A: Find the SteamGridDB Game ID
            let mut sgdb_game_id: Option<u32> = None;

            if game.source == "steam" {
                if let Some(ref app_id) = game.source_app_id {
                    let url = format!("https://www.steamgriddb.com/api/v2/games/steam/{}", app_id);
                    if let Ok(res) = client.get(&url).header("Authorization", &auth_header).send() {
                        if res.status().is_success() {
                            if let Ok(resp) = res.json::<SgdbResponse<SgdbGame>>() {
                                if let Some(sgdb_game) = resp.data {
                                    sgdb_game_id = Some(sgdb_game.id);
                                }
                            }
                        }
                    }
                }
            }

            // Fallback: Autocomplete search by title if game ID not found yet
            if sgdb_game_id.is_none() {
                let term = percent_encoding::utf8_percent_encode(&game.title, percent_encoding::NON_ALPHANUMERIC).to_string();
                let url = format!("https://www.steamgriddb.com/api/v2/search/autocomplete/quick?term={}", term);
                if let Ok(res) = client.get(&url).header("Authorization", &auth_header).send() {
                    if res.status().is_success() {
                        if let Ok(resp) = res.json::<SgdbResponse<Vec<SgdbGame>>>() {
                            if let Some(mut games) = resp.data {
                                if !games.is_empty() {
                                    sgdb_game_id = Some(games.remove(0).id);
                                }
                            }
                        }
                    }
                }
            }

            // Step B: Download assets if we have a SteamGridDB Game ID
            if let Some(sg_id) = sgdb_game_id {
                let art_dir = get_game_artwork_dir(game_id);
                let mut artwork = game.artwork.clone().unwrap_or_else(|| GameArtwork {
                    game_id: game_id.to_string(),
                    cover_path: None,
                    hero_path: None,
                    logo_path: None,
                    icon_path: None,
                    source: "steamgriddb".to_string(),
                    updated_at: Local::now().to_rfc3339(),
                });

                // Download cover art (Vertical grid - 600x900 dimension preferred)
                let grids_url = format!("https://www.steamgriddb.com/api/v2/grids/game/{}?dimensions=600x900", sg_id);
                if let Ok(res) = client.get(&grids_url).header("Authorization", &auth_header).send() {
                    if res.status().is_success() {
                        if let Ok(resp) = res.json::<SgdbResponse<Vec<SgdbAsset>>>() {
                            if let Some(mut grids) = resp.data {
                                if !grids.is_empty() {
                                    let grid_url = grids.remove(0).url;
                                    let cover_dest = art_dir.join("cover.jpg");
                                    if download_file(&grid_url, &cover_dest).is_ok() {
                                        artwork.cover_path = Some(cover_dest.to_string_lossy().to_string());
                                        game.artwork_path = Some(cover_dest.to_string_lossy().to_string());
                                    }
                                }
                            }
                        }
                    }
                }

                // Download hero banner image
                let heroes_url = format!("https://www.steamgriddb.com/api/v2/heroes/game/{}", sg_id);
                if let Ok(res) = client.get(&heroes_url).header("Authorization", &auth_header).send() {
                    if res.status().is_success() {
                        if let Ok(resp) = res.json::<SgdbResponse<Vec<SgdbAsset>>>() {
                            if let Some(mut heroes) = resp.data {
                                if !heroes.is_empty() {
                                    let hero_url = heroes.remove(0).url;
                                    let hero_dest = art_dir.join("hero.jpg");
                                    if download_file(&hero_url, &hero_dest).is_ok() {
                                        artwork.hero_path = Some(hero_dest.to_string_lossy().to_string());
                                    }
                                }
                            }
                        }
                    }
                }

                // Download logo image
                let logos_url = format!("https://www.steamgriddb.com/api/v2/logos/game/{}", sg_id);
                if let Ok(res) = client.get(&logos_url).header("Authorization", &auth_header).send() {
                    if res.status().is_success() {
                        if let Ok(resp) = res.json::<SgdbResponse<Vec<SgdbAsset>>>() {
                            if let Some(mut logos) = resp.data {
                                if !logos.is_empty() {
                                    let logo_url = logos.remove(0).url;
                                    let logo_dest = art_dir.join("logo.png");
                                    if download_file(&logo_url, &logo_dest).is_ok() {
                                        artwork.logo_path = Some(logo_dest.to_string_lossy().to_string());
                                    }
                                }
                            }
                        }
                    }
                }

                // Download icon image
                let icons_url = format!("https://www.steamgriddb.com/api/v2/icons/game/{}", sg_id);
                if let Ok(res) = client.get(&icons_url).header("Authorization", &auth_header).send() {
                    if res.status().is_success() {
                        if let Ok(resp) = res.json::<SgdbResponse<Vec<SgdbAsset>>>() {
                            if let Some(mut icons) = resp.data {
                                if !icons.is_empty() {
                                    let icon_url = icons.remove(0).url;
                                    let icon_dest = art_dir.join("icon.png");
                                    if download_file(&icon_url, &icon_dest).is_ok() {
                                        artwork.icon_path = Some(icon_dest.to_string_lossy().to_string());
                                    }
                                }
                            }
                        }
                    }
                }

                artwork.source = "steamgriddb".to_string();
                artwork.updated_at = Local::now().to_rfc3339();
                game.artwork = Some(artwork);
            }
        }
    }

    // Save final updated game (including IGDB metadata & nested artwork updates) back into SQLite
    game.updated_at = Local::now().to_rfc3339();
    queries::insert_or_update_game(&conn, &game).map_err(|e| e.to_string())?;

    Ok(game)
}
