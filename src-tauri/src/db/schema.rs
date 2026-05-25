use rusqlite::Connection;

pub fn init_schema(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS games (
            id TEXT PRIMARY KEY,
            source TEXT NOT NULL,
            source_app_id TEXT,
            title TEXT NOT NULL,
            install_path TEXT,
            launch_method TEXT NOT NULL,
            launch_uri TEXT,
            launch_exe TEXT,
            launch_args TEXT,
            artwork_path TEXT,
            status TEXT NOT NULL DEFAULT 'installed',
            favorite INTEGER NOT NULL DEFAULT 0,
            hidden INTEGER NOT NULL DEFAULT 0,
            last_played_at TEXT,
            playtime_seconds INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS library_sources (
            id TEXT PRIMARY KEY,
            source TEXT NOT NULL,
            detected_path TEXT NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 1,
            last_scan_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS process_signatures (
            id TEXT PRIMARY KEY,
            game_id TEXT NOT NULL,
            exe_name TEXT,
            exe_path TEXT,
            confidence INTEGER NOT NULL DEFAULT 50,
            last_seen_pid INTEGER,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE
        );",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS game_artwork (
            game_id TEXT PRIMARY KEY,
            cover_path TEXT,
            hero_path TEXT,
            logo_path TEXT,
            icon_path TEXT,
            source TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE
        );",
        [],
    )?;

    // Create key-value settings table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );",
        [],
    )?;

    // Run migrations to append rich metadata fields to the games table if they don't exist
    let _ = conn.execute("ALTER TABLE games ADD COLUMN description TEXT;", []);
    let _ = conn.execute("ALTER TABLE games ADD COLUMN release_date TEXT;", []);
    let _ = conn.execute("ALTER TABLE games ADD COLUMN genres TEXT;", []);
    let _ = conn.execute("ALTER TABLE games ADD COLUMN developer TEXT;", []);
    let _ = conn.execute("ALTER TABLE games ADD COLUMN esrb_rating TEXT;", []);
    let _ = conn.execute("ALTER TABLE games ADD COLUMN runner_type TEXT;", []);
    let _ = conn.execute("ALTER TABLE games ADD COLUMN runner_path TEXT;", []);
    let _ = conn.execute("ALTER TABLE games ADD COLUMN runner_prefix TEXT;", []);


    Ok(())
}
