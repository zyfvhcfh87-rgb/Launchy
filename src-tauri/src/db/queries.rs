use rusqlite::{params, Connection, Result};
use crate::models::game::{Game, LibrarySource, ProcessSignature, GameArtwork};

pub fn get_all_games(conn: &Connection) -> Result<Vec<Game>> {
    let mut stmt = conn.prepare("
        SELECT g.id, g.source, g.source_app_id, g.title, g.install_path, g.launch_method, g.launch_uri, g.launch_exe, g.launch_args, g.artwork_path, g.status, g.favorite, g.hidden, g.last_played_at, g.playtime_seconds, g.created_at, g.updated_at,
               a.cover_path, a.hero_path, a.logo_path, a.icon_path, a.source, a.updated_at
        FROM games g
        LEFT JOIN game_artwork a ON g.id = a.game_id
        ORDER BY g.title ASC
    ")?;
    let game_iter = stmt.query_map([], |row| {
        let art_source: Option<String> = row.get(21)?;
        let artwork = if let Some(source) = art_source {
            Some(GameArtwork {
                game_id: row.get(0)?,
                cover_path: row.get(17)?,
                hero_path: row.get(18)?,
                logo_path: row.get(19)?,
                icon_path: row.get(20)?,
                source,
                updated_at: row.get(22)?,
            })
        } else {
            None
        };
        Ok(Game {
            id: row.get(0)?,
            source: row.get(1)?,
            source_app_id: row.get(2)?,
            title: row.get(3)?,
            install_path: row.get(4)?,
            launch_method: row.get(5)?,
            launch_uri: row.get(6)?,
            launch_exe: row.get(7)?,
            launch_args: row.get(8)?,
            artwork_path: row.get(9)?,
            status: row.get(10)?,
            favorite: row.get::<_, i32>(11)? != 0,
            hidden: row.get::<_, i32>(12)? != 0,
            last_played_at: row.get(13)?,
            playtime_seconds: row.get(14)?,
            created_at: row.get(15)?,
            updated_at: row.get(16)?,
            artwork,
        })
    })?;

    let mut games = Vec::new();
    for game in game_iter {
        games.push(game?);
    }
    Ok(games)
}

pub fn get_game_by_id(conn: &Connection, id: &str) -> Result<Option<Game>> {
    let mut stmt = conn.prepare("
        SELECT g.id, g.source, g.source_app_id, g.title, g.install_path, g.launch_method, g.launch_uri, g.launch_exe, g.launch_args, g.artwork_path, g.status, g.favorite, g.hidden, g.last_played_at, g.playtime_seconds, g.created_at, g.updated_at,
               a.cover_path, a.hero_path, a.logo_path, a.icon_path, a.source, a.updated_at
        FROM games g
        LEFT JOIN game_artwork a ON g.id = a.game_id
        WHERE g.id = ?1
    ")?;
    let mut game_iter = stmt.query_map([id], |row| {
        let art_source: Option<String> = row.get(21)?;
        let artwork = if let Some(source) = art_source {
            Some(GameArtwork {
                game_id: row.get(0)?,
                cover_path: row.get(17)?,
                hero_path: row.get(18)?,
                logo_path: row.get(19)?,
                icon_path: row.get(20)?,
                source,
                updated_at: row.get(22)?,
            })
        } else {
            None
        };
        Ok(Game {
            id: row.get(0)?,
            source: row.get(1)?,
            source_app_id: row.get(2)?,
            title: row.get(3)?,
            install_path: row.get(4)?,
            launch_method: row.get(5)?,
            launch_uri: row.get(6)?,
            launch_exe: row.get(7)?,
            launch_args: row.get(8)?,
            artwork_path: row.get(9)?,
            status: row.get(10)?,
            favorite: row.get::<_, i32>(11)? != 0,
            hidden: row.get::<_, i32>(12)? != 0,
            last_played_at: row.get(13)?,
            playtime_seconds: row.get(14)?,
            created_at: row.get(15)?,
            updated_at: row.get(16)?,
            artwork,
        })
    })?;

    if let Some(game) = game_iter.next() {
        Ok(Some(game?))
    } else {
        Ok(None)
    }
}

pub fn insert_or_update_game(conn: &Connection, game: &Game) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO games (id, source, source_app_id, title, install_path, launch_method, launch_uri, launch_exe, launch_args, artwork_path, status, favorite, hidden, last_played_at, playtime_seconds, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
        params![
            game.id,
            game.source,
            game.source_app_id,
            game.title,
            game.install_path,
            game.launch_method,
            game.launch_uri,
            game.launch_exe,
            game.launch_args,
            game.artwork_path,
            game.status,
            if game.favorite { 1 } else { 0 },
            if game.hidden { 1 } else { 0 },
            game.last_played_at,
            game.playtime_seconds,
            game.created_at,
            game.updated_at
        ],
    )?;

    if let Some(ref artwork) = game.artwork {
        insert_or_update_artwork(conn, artwork)?;
    }

    Ok(())
}

pub fn toggle_favorite(conn: &Connection, id: &str) -> Result<()> {
    conn.execute(
        "UPDATE games SET favorite = CASE WHEN favorite = 1 THEN 0 ELSE 1 END, updated_at = datetime('now') WHERE id = ?1",
        [id],
    )?;
    Ok(())
}

pub fn set_hidden(conn: &Connection, id: &str, hidden: bool) -> Result<()> {
    conn.execute(
        "UPDATE games SET hidden = ?1, updated_at = datetime('now') WHERE id = ?2",
        params![if hidden { 1 } else { 0 }, id],
    )?;
    Ok(())
}

pub fn update_status(conn: &Connection, id: &str, status: &str) -> Result<()> {
    conn.execute(
        "UPDATE games SET status = ?1, updated_at = datetime('now') WHERE id = ?2",
        params![status, id],
    )?;
    Ok(())
}

pub fn update_playtime_and_last_played(conn: &Connection, id: &str, playtime_increment: i32, last_played: &str) -> Result<()> {
    conn.execute(
        "UPDATE games SET playtime_seconds = playtime_seconds + ?1, last_played_at = ?2, updated_at = datetime('now') WHERE id = ?3",
        params![playtime_increment, last_played, id],
    )?;
    Ok(())
}

pub fn insert_or_update_signature(conn: &Connection, sig: &ProcessSignature) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO process_signatures (id, game_id, exe_name, exe_path, confidence, last_seen_pid, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            sig.id,
            sig.game_id,
            sig.exe_name,
            sig.exe_path,
            sig.confidence,
            sig.last_seen_pid,
            sig.created_at,
            sig.updated_at
        ],
    )?;
    Ok(())
}

pub fn get_signatures_for_game(conn: &Connection, game_id: &str) -> Result<Vec<ProcessSignature>> {
    let mut stmt = conn.prepare("SELECT id, game_id, exe_name, exe_path, confidence, last_seen_pid, created_at, updated_at FROM process_signatures WHERE game_id = ?1")?;
    let sig_iter = stmt.query_map([game_id], |row| {
        Ok(ProcessSignature {
            id: row.get(0)?,
            game_id: row.get(1)?,
            exe_name: row.get(2)?,
            exe_path: row.get(3)?,
            confidence: row.get(4)?,
            last_seen_pid: row.get(5)?,
            created_at: row.get(6)?,
            updated_at: row.get(7)?,
        })
    })?;

    let mut sigs = Vec::new();
    for sig in sig_iter {
        sigs.push(sig?);
    }
    Ok(sigs)
}

pub fn get_all_signatures(conn: &Connection) -> Result<Vec<ProcessSignature>> {
    let mut stmt = conn.prepare("SELECT id, game_id, exe_name, exe_path, confidence, last_seen_pid, created_at, updated_at FROM process_signatures")?;
    let sig_iter = stmt.query_map([], |row| {
        Ok(ProcessSignature {
            id: row.get(0)?,
            game_id: row.get(1)?,
            exe_name: row.get(2)?,
            exe_path: row.get(3)?,
            confidence: row.get(4)?,
            last_seen_pid: row.get(5)?,
            created_at: row.get(6)?,
            updated_at: row.get(7)?,
        })
    })?;

    let mut sigs = Vec::new();
    for sig in sig_iter {
        sigs.push(sig?);
    }
    Ok(sigs)
}

pub fn get_library_sources(conn: &Connection) -> Result<Vec<LibrarySource>> {
    let mut stmt = conn.prepare("SELECT id, source, detected_path, enabled, last_scan_at, created_at, updated_at FROM library_sources")?;
    let src_iter = stmt.query_map([], |row| {
        Ok(LibrarySource {
            id: row.get(0)?,
            source: row.get(1)?,
            detected_path: row.get(2)?,
            enabled: row.get::<_, i32>(3)? != 0,
            last_scan_at: row.get(4)?,
            created_at: row.get(5)?,
            updated_at: row.get(6)?,
        })
    })?;

    let mut srcs = Vec::new();
    for src in src_iter {
        srcs.push(src?);
    }
    Ok(srcs)
}

pub fn insert_library_source(conn: &Connection, source: &LibrarySource) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO library_sources (id, source, detected_path, enabled, last_scan_at, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            source.id,
            source.source,
            source.detected_path,
            if source.enabled { 1 } else { 0 },
            source.last_scan_at,
            source.created_at,
            source.updated_at
        ],
    )?;
    Ok(())
}

pub fn remove_library_source(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM library_sources WHERE id = ?1", [id])?;
    Ok(())
}

pub fn update_artwork_path(conn: &Connection, id: &str, path: Option<String>) -> Result<()> {
    conn.execute(
        "UPDATE games SET artwork_path = ?1, updated_at = datetime('now') WHERE id = ?2",
        params![path, id],
    )?;
    Ok(())
}

pub fn insert_or_update_artwork(conn: &Connection, artwork: &GameArtwork) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO game_artwork (game_id, cover_path, hero_path, logo_path, icon_path, source, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            artwork.game_id,
            artwork.cover_path,
            artwork.hero_path,
            artwork.logo_path,
            artwork.icon_path,
            artwork.source,
            artwork.updated_at
        ],
    )?;
    Ok(())
}

pub fn delete_artwork(conn: &Connection, game_id: &str) -> Result<()> {
    conn.execute(
        "DELETE FROM game_artwork WHERE game_id = ?1",
        params![game_id],
    )?;
    Ok(())
}



