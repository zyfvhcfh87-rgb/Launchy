pub mod schema;
pub mod queries;

use std::fs;
use std::path::PathBuf;
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
    schema::init_schema(&conn)?;
    Ok(conn)
}
