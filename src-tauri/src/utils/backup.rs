use std::fs::{self, File};
use std::io::{self, Write, Read};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use walkdir::WalkDir;
use zip::write::FileOptions;
use zip::{ZipArchive, ZipWriter};

// Global safety flag to pause the background process crawler during DB restorations
pub static IS_RESTORING: AtomicBool = AtomicBool::new(false);

fn get_app_dir() -> PathBuf {
    let mut path = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("Launchy");
    let _ = fs::create_dir_all(&path);
    path
}

pub fn export_backup(dest_zip_path: &str) -> Result<(), String> {
    let app_dir = get_app_dir();
    let db_path = app_dir.join("launchy.db");
    let artwork_dir = app_dir.join("artwork");

    let file = File::create(dest_zip_path)
        .map_err(|e| format!("Failed to create backup file: {}", e))?;
    let mut zip = ZipWriter::new(file);
    let options = FileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o755);

    // 1. Pack SQLite database
    if db_path.exists() {
        let mut db_file = File::open(&db_path)
            .map_err(|e| format!("Failed to open local database for backup: {}", e))?;
        let mut buffer = Vec::new();
        db_file.read_to_end(&mut buffer)
            .map_err(|e| format!("Failed to read database file: {}", e))?;

        zip.start_file("launchy.db", options)
            .map_err(|e| format!("Failed to initialize launchy.db in zip: {}", e))?;
        zip.write_all(&buffer)
            .map_err(|e| format!("Failed to write launchy.db in zip: {}", e))?;
    }

    // 2. Pack artwork cache folder recursively
    if artwork_dir.exists() {
        for entry in WalkDir::new(&artwork_dir) {
            let entry = entry.map_err(|e| format!("Failed to read artwork directory entry: {}", e))?;
            let path = entry.path();
            
            // Generate the relative path inside the zip file
            let relative_path = match path.strip_prefix(&app_dir) {
                Ok(p) => p.to_string_lossy().to_string().replace('\\', "/"),
                Err(_) => continue,
            };

            if path.is_file() {
                let mut f = File::open(path)
                    .map_err(|e| format!("Failed to open cached artwork file: {}", e))?;
                let mut buffer = Vec::new();
                f.read_to_end(&mut buffer)
                    .map_err(|e| format!("Failed to read artwork file: {}", e))?;

                zip.start_file(&relative_path, options)
                    .map_err(|e| format!("Failed to initialize {} in zip: {}", relative_path, e))?;
                zip.write_all(&buffer)
                    .map_err(|e| format!("Failed to write artwork file to zip: {}", e))?;
            } else if path.is_dir() && !relative_path.is_empty() {
                // Add empty directory entries if needed
                zip.add_directory(&relative_path, options)
                    .map_err(|e| format!("Failed to add artwork subfolder in zip: {}", e))?;
            }
        }
    }

    zip.finish().map_err(|e| format!("Failed to finalize zip compression: {}", e))?;

    Ok(())
}

struct RestoreGuard;

impl Drop for RestoreGuard {
    fn drop(&mut self) {
        IS_RESTORING.store(false, Ordering::SeqCst);
    }
}

pub fn import_backup(src_zip_path: &str) -> Result<(), String> {
    // 1. Pause background process monitor ticks
    IS_RESTORING.store(true, Ordering::SeqCst);

    // Ensure we reset the state when leaving the function using a custom Drop guard
    let _restore_guard = RestoreGuard;

    let app_dir = get_app_dir();
    let db_path = app_dir.join("launchy.db");
    let db_bak_path = app_dir.join("launchy.db.bak");
    let artwork_dir = app_dir.join("artwork");
    let artwork_bak_dir = app_dir.join("artwork.bak");

    // Sleep briefly to ensure process monitor drops active SQLite connection if it's currently on a tick
    std::thread::sleep(std::time::Duration::from_millis(300));

    // 2. Perform safe transactional database & folder backing up
    if db_path.exists() {
        if db_bak_path.exists() {
            let _ = fs::remove_file(&db_bak_path);
        }
        fs::rename(&db_path, &db_bak_path)
            .map_err(|e| format!("Failed to backup current database: {}", e))?;
    }

    let artwork_existed = artwork_dir.exists();
    if artwork_existed {
        if artwork_bak_dir.exists() {
            let _ = fs::remove_dir_all(&artwork_bak_dir);
        }
        fs::rename(&artwork_dir, &artwork_bak_dir)
            .map_err(|e| format!("Failed to backup current artwork: {}", e))?;
    }

    // Ensure artwork target folder is clean and available
    let _ = fs::create_dir_all(&artwork_dir);

    // 3. Open and extract the backup zip file
    let file = File::open(src_zip_path)
        .map_err(|e| format!("Failed to open backup zip file: {}", e))?;
    let mut archive = ZipArchive::new(file)
        .map_err(|e| format!("Failed to read backup zip archive: {}", e))?;

    let mut success = true;
    let mut error_msg = String::new();

    for i in 0..archive.len() {
        let mut file = match archive.by_index(i) {
            Ok(f) => f,
            Err(e) => {
                success = false;
                error_msg = format!("Failed to read zip index: {}", e);
                break;
            }
        };

        let outpath = match file.enclosed_name() {
            Some(path) => app_dir.join(path),
            None => continue,
        };

        if file.name().ends_with('/') {
            if let Err(e) = fs::create_dir_all(&outpath) {
                success = false;
                error_msg = format!("Failed to create extracted directory: {}", e);
                break;
            }
        } else {
            if let Some(p) = outpath.parent() {
                if !p.exists() {
                    if let Err(e) = fs::create_dir_all(p) {
                        success = false;
                        error_msg = format!("Failed to create parent directory for extraction: {}", e);
                        break;
                    }
                }
            }

            let mut outfile = match File::create(&outpath) {
                Ok(f) => f,
                Err(e) => {
                    success = false;
                    error_msg = format!("Failed to create extracted file: {}", e);
                    break;
                }
            };

            if let Err(e) = io::copy(&mut file, &mut outfile) {
                success = false;
                error_msg = format!("Failed to write extracted file contents: {}", e);
                break;
            }
        }
    }

    // 4. Resolve Transaction (Commit or Rollback)
    if success {
        // Verification step: Try to open the newly imported database to ensure it's not corrupted
        if let Ok(conn) = rusqlite::Connection::open(&db_path) {
            if conn.execute("PRAGMA integrity_check;", []).is_ok() {
                // Database is perfectly sound! Clean up .bak backups
                if db_bak_path.exists() {
                    let _ = fs::remove_file(&db_bak_path);
                }
                if artwork_bak_dir.exists() {
                    let _ = fs::remove_dir_all(&artwork_bak_dir);
                }
                return Ok(());
            }
        }
        error_msg = "Database integrity check failed.".to_string();
    }

    // Rollback: Database extraction failed or file is corrupted. Restore original state!
    if db_path.exists() {
        let _ = fs::remove_file(&db_path);
    }
    if artwork_dir.exists() {
        let _ = fs::remove_dir_all(&artwork_dir);
    }

    if db_bak_path.exists() {
        let _ = fs::rename(&db_bak_path, &db_path);
    }
    if artwork_bak_dir.exists() {
        let _ = fs::rename(&artwork_bak_dir, &artwork_dir);
    }

    Err(format!("Import transaction rolled back: {}", error_msg))
}
