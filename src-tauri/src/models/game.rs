use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Game {
    pub id: String,
    pub source: String,
    pub source_app_id: Option<String>,
    pub title: String,
    pub install_path: Option<String>,
    pub launch_method: String,
    pub launch_uri: Option<String>,
    pub launch_exe: Option<String>,
    pub launch_args: Option<String>,
    pub artwork_path: Option<String>,
    pub status: String,
    pub favorite: bool,
    pub hidden: bool,
    pub last_played_at: Option<String>,
    pub playtime_seconds: i32,
    pub created_at: String,
    pub updated_at: String,
    pub artwork: Option<GameArtwork>,
    pub description: Option<String>,
    pub release_date: Option<String>,
    pub genres: Option<String>,
    pub developer: Option<String>,
    pub esrb_rating: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameArtwork {
    pub game_id: String,
    pub cover_path: Option<String>,
    pub hero_path: Option<String>,
    pub logo_path: Option<String>,
    pub icon_path: Option<String>,
    pub source: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LibrarySource {
    pub id: String,
    pub source: String,
    pub detected_path: String,
    pub enabled: bool,
    pub last_scan_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessSignature {
    pub id: String,
    pub game_id: String,
    pub exe_name: Option<String>,
    pub exe_path: Option<String>,
    pub confidence: i32,
    pub last_seen_pid: Option<u32>,
    pub created_at: String,
    pub updated_at: String,
}
