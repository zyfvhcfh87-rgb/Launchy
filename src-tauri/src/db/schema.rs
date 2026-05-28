use rusqlite::Connection;

fn add_column_if_missing(
    conn: &Connection,
    table: &str,
    column: &str,
    definition: &str,
) -> Result<(), rusqlite::Error> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({})", table))?;
    let columns = stmt.query_map([], |row| row.get::<_, String>(1))?;

    for existing_column in columns {
        if existing_column? == column {
            return Ok(());
        }
    }

    conn.execute(
        &format!("ALTER TABLE {} ADD COLUMN {} {}", table, column, definition),
        [],
    )?;

    Ok(())
}

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

    // Create playtime sessions table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS playtime_sessions (
            id TEXT PRIMARY KEY,
            game_id TEXT NOT NULL,
            playtime_seconds INTEGER NOT NULL,
            played_at TEXT NOT NULL,
            FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE
        );",
        [],
    )?;

    // Create custom categories table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS categories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL
        );",
        [],
    )?;

    // Create game categories mapping table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS game_categories (
            game_id TEXT NOT NULL,
            category_id TEXT NOT NULL,
            PRIMARY KEY(game_id, category_id),
            FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE,
            FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE
        );",
        [],
    )?;

    // Run migrations to append rich metadata fields to the games table if they don't exist
    add_column_if_missing(conn, "games", "description", "TEXT")?;
    add_column_if_missing(conn, "games", "release_date", "TEXT")?;
    add_column_if_missing(conn, "games", "genres", "TEXT")?;
    add_column_if_missing(conn, "games", "developer", "TEXT")?;
    add_column_if_missing(conn, "games", "esrb_rating", "TEXT")?;
    add_column_if_missing(conn, "games", "runner_type", "TEXT")?;
    add_column_if_missing(conn, "games", "runner_path", "TEXT")?;
    add_column_if_missing(conn, "games", "runner_prefix", "TEXT")?;

    conn.execute("CREATE INDEX IF NOT EXISTS idx_games_source ON games(source);", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_games_hidden ON games(hidden);", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_games_favorite ON games(favorite);", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_playtime_sessions_played_at ON playtime_sessions(played_at);", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_game_categories_category_id ON game_categories(category_id);", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_process_signatures_game_id ON process_signatures(game_id);", [])?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn column_exists(conn: &Connection, table: &str, column: &str) -> bool {
        let mut stmt = conn.prepare(&format!("PRAGMA table_info({})", table)).unwrap();
        let columns = stmt
            .query_map([], |row| row.get::<_, String>(1))
            .unwrap();

        let exists = columns.filter_map(Result::ok).any(|name| name == column);
        exists
    }

    fn index_exists(conn: &Connection, index: &str) -> bool {
        conn.query_row(
            "SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = ?1",
            [index],
            |_| Ok(()),
        )
        .is_ok()
    }

    #[test]
    fn init_schema_is_idempotent_and_creates_indexes() {
        let conn = Connection::open_in_memory().unwrap();

        init_schema(&conn).unwrap();
        init_schema(&conn).unwrap();

        assert!(column_exists(&conn, "games", "runner_prefix"));
        assert!(index_exists(&conn, "idx_games_source"));
        assert!(index_exists(&conn, "idx_playtime_sessions_played_at"));
    }

    #[test]
    fn init_schema_migrates_legacy_games_table() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute(
            "CREATE TABLE games (
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
        )
        .unwrap();

        init_schema(&conn).unwrap();

        assert!(column_exists(&conn, "games", "description"));
        assert!(column_exists(&conn, "games", "release_date"));
        assert!(column_exists(&conn, "games", "runner_type"));
        assert!(column_exists(&conn, "games", "runner_prefix"));
    }
}
