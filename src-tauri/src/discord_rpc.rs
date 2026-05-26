use std::sync::Mutex;
use std::sync::OnceLock;
use std::time::SystemTime;
use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};

static DISCORD_CLIENT: OnceLock<Mutex<Option<DiscordIpcClient>>> = OnceLock::new();

fn get_client() -> &'static Mutex<Option<DiscordIpcClient>> {
    DISCORD_CLIENT.get_or_init(|| Mutex::new(None))
}

pub fn connect() -> Result<(), String> {
    let mut client_lock = get_client().lock().unwrap();
    if client_lock.is_none() {
        // Create client with Launchy default Application ID
        let mut client = DiscordIpcClient::new("1376307300305895424")
            .map_err(|e| format!("Failed to initialize Discord client: {}", e))?;
        
        if let Err(e) = client.connect() {
            return Err(format!("Failed to connect to Discord IPC socket: {}", e));
        }
        *client_lock = Some(client);
    }
    Ok(())
}

pub fn set_activity(game_title: &str, elapsed_seconds: i32) -> Result<(), String> {
    // Attempt to establish connection if missing
    if let Err(e) = connect() {
        return Err(e);
    }

    let mut client_lock = get_client().lock().unwrap();
    if let Some(ref mut client) = *client_lock {
        let start_time = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .map(|d| d.as_secs() as i64 - elapsed_seconds as i64)
            .unwrap_or(0);

        let assets = activity::Assets::new()
            .large_image("launchy_logo")
            .large_text("Launchy Launcher");

        let timestamps = activity::Timestamps::new()
            .start(start_time);

        let payload = activity::Activity::new()
            .details(game_title)
            .state("Playing via Launchy")
            .assets(assets)
            .timestamps(timestamps);

        if let Err(e) = client.set_activity(payload) {
            // Drop client state so we retry from scratch next time
            *client_lock = None;
            return Err(format!("Failed to set active presence: {}", e));
        }
    }
    Ok(())
}

pub fn clear_activity() -> Result<(), String> {
    let mut client_lock = get_client().lock().unwrap();
    if let Some(ref mut client) = *client_lock {
        if let Err(e) = client.clear_activity() {
            // Drop client state if communications fail
            *client_lock = None;
            return Err(format!("Failed to clear active presence: {}", e));
        }
    }
    Ok(())
}

pub fn close() {
    let mut client_lock = get_client().lock().unwrap();
    if let Some(mut client) = client_lock.take() {
        let _ = client.close();
    }
}
