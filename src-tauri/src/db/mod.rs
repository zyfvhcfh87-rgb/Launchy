pub mod schema;
pub mod queries;

use std::fs;
use std::path::PathBuf;
use std::time::Duration;
use rusqlite::Connection;

pub fn get_db_path() -> PathBuf {
    let mut path = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("Launchy");
    // Ensure directory exists
    let _ = fs::create_dir_all(&path);
    path.push("launchy.db");
    path
}

pub fn establish_connection() -> Result<Connection, rusqlite::Error> {
    let db_path = get_db_path();
    let conn = Connection::open(db_path)?;
    conn.busy_timeout(Duration::from_secs(5))?;
    Ok(conn)
}

pub fn initialize_database() -> Result<(), rusqlite::Error> {
    let conn = establish_connection()?;
    schema::init_schema(&conn)
}
