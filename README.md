# Launchy

Launchy is a local-first desktop game launcher built with Tauri, React, TypeScript, and Rust. It brings Steam, Epic Games, and manually added standalone games into one library view, lets you launch games from a single interface, and tracks basic play status and playtime locally.

The app is currently an early alpha. The core desktop shell, library UI, local SQLite storage, Steam/Epic scanners, manual game registration, launching, favorites, hidden games, artwork overrides, and process-based status monitoring are already present.

## Highlights

- **Unified Game Library**: Aggregates Steam, Epic Games, and custom standalone executable entries in a unified responsive dashboard.
- **Robust Auto-Discovery Scanners**: Crawls Steam `appmanifest_*.acf` files (leveraging Windows Registry-first discovery) and parses Epic `.item` manifests.
- **Asynchronous Artwork CDN Fetcher**: Auto-downloads vertical covers (`library_600x900.jpg`) and horizontal hero banners (`library_hero.jpg`) in a background worker thread. Utilizes sequential fallback sequences across Cloudflare and Akamai CDNs.
- **Manual Cover Overrides**: Allows selecting persistent cover art using native OS file selectors and copying selected images directly into the local `artwork` cache directory.
- **Rich Library Sorting & Ordering**: Features a modern Lucide-icon select dropdown offering dynamic sorting: Title (A-Z/Z-A), Favorites First, Recently Played, Most Played, Source/Platform, and Recently Added.
- **Playtime & Session Tracker**: Employs an extremely lightweight background process monitor that tracks system executables and folders every 3 seconds to log last-played dates and compute accumulated playtime.
- **Interactive Details Drawer**: Displays full source metadata, installation directories, responsive cover card visuals, wide horizontal hero graphics (`h-44`), and custom command line argument configurations.
- **Open Installation Directory Action**: Lets users open game folders in the native OS File Explorer directly from game cards or the details drawer.
- **Local SQLite Persistence**: Persists all settings, library folders, process signatures, and playtime tracking locally in a unified SQLite database (`launchy.db`). No telemetry, accounts, or launchers are injected.

## Screens and Flows

Launchy is organized around two main areas:

- **Library**: browse all discovered games, filter by source, search by title, sort with polished dropdown parameters, favorite or hide entries, open details, and launch games.
- **Settings**: scan libraries, add custom Steam/Epic scan folders, register standalone games, and review local scanner diagnostics.

When running outside the Tauri desktop shell, the React UI falls back to mock data so the interface can still be developed in a browser with Vite.

## Tech Stack

- **Desktop shell**: Tauri 2
- **Frontend**: React 19, TypeScript, Vite 7
- **Styling**: Tailwind CSS 4 and custom CSS
- **Icons**: lucide-react
- **Backend**: Rust
- **Storage**: SQLite through `rusqlite`
- **Native helpers**: `reqwest`, `open`, `rfd`, `sysinfo`, `dirs`, `walkdir`, `regex`, `chrono`, `winreg`

## Repository Structure

```text
.
|-- src/                         # React frontend
|   |-- components/              # Game cards, sidebar, search, modals, badges
|   |-- pages/                   # Library, settings, and game details views
|   |-- types/                   # Shared TypeScript models
|   `-- utils/                   # Artwork URL/file helpers
|-- src-tauri/                   # Rust/Tauri backend
|   |-- src/commands/            # Tauri command handlers exposed to React
|   |-- src/db/                  # SQLite schema and queries
|   |-- src/launcher/            # Steam, Epic, and manual launchers
|   |-- src/models/              # Rust data models
|   |-- src/process_monitor/     # Background status/playtime tracking
|   |-- src/scanners/            # Steam, Epic, and manual import logic
|   `-- tauri.conf.json          # Tauri app configuration
|-- package.json                 # Node scripts and frontend dependencies
|-- vite.config.ts               # Vite config for Tauri development
`-- README.md
```

## Requirements

- Windows is the primary target at the moment. Several scanner paths are Windows-specific.
- Node.js and npm.
- Rust and Cargo.
- Tauri system prerequisites for your OS.
- Steam and/or Epic Games Launcher installed if you want automatic library discovery from those platforms.

For Tauri setup help, see the official Tauri prerequisites:

https://tauri.app/start/prerequisites/

## Getting Started

Install dependencies:

```bash
npm install
```

Run the web UI only:

```bash
npm run dev
```

Run the full Tauri desktop app:

```bash
npm run tauri dev
```

Build the frontend:

```bash
npm run build
```

Build the desktop bundle:

```bash
npm run tauri build
```

## Available Scripts

- `npm run dev` starts the Vite development server.
- `npm run build` type-checks the frontend and builds the web assets.
- `npm run preview` previews the built frontend.
- `npm run tauri` runs Tauri CLI commands, such as `npm run tauri dev` or `npm run tauri build`.

## How Library Scanning Works

### Steam

Launchy dynamically detects the Steam installation folder by checking the Windows Registry. It inspects:

- `HKEY_CURRENT_USER\Software\Valve\Steam` (checks both the `SteamPath` and `SteamExe` keys)
- `HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node\Valve\Steam` (`InstallPath` key)
- `HKEY_LOCAL_MACHINE\SOFTWARE\Valve\Steam` (`InstallPath` key)

If registry discovery yields nothing, it falls back to checking common default Windows install folders:

- `C:\Program Files (x86)\Steam`
- `C:\Program Files\Steam`

Once located, it reads the Steam library folder configuration from `steamapps\libraryfolders.vdf`, scans `appmanifest_*.acf` files, imports title/app ID/install directory metadata, and creates a `steam://rungameid/<appid>` launch URI.

Custom Steam library folders can also be added from the Settings page. A custom folder may point at either the Steam library root or the `steamapps` directory.

### Epic Games

Launchy reads Epic Games manifest files from:

- `C:\ProgramData\Epic\EpicGamesLauncher\Data\Manifests`

It parses `.item` files for game title, app name, install location, launch executable, catalog identifiers, and builds an Epic Launcher protocol URI when possible.

Custom Epic manifest directories can be added from Settings.

### Manual Games

Manual entries are for games or tools that do not come from Steam or Epic. You provide:

- title
- executable path
- optional launch arguments
- optional artwork path or URL

Launchy stores the executable name, install folder, arguments, artwork, and a process signature for status detection.

## Data Storage

Launchy stores its local database at:

```text
%APPDATA%\Launchy\launchy.db
```

The database contains:

- imported games
- custom library source folders
- process signatures used for status and playtime tracking
- favorites, hidden state, artwork paths, last-played values, and playtime totals

Everything is local to the machine. Launchy does not require an account and does not sync data to a remote service.

## Launching and Status Tracking

Launchy launches games in one of two ways:

- **URI launch**: Steam and Epic entries are opened through their platform URI schemes.
- **Executable launch**: manual entries are spawned directly from their executable path.

A Rust background monitor checks running processes every few seconds. It matches running games by install path or expected executable name, updates the local database, and emits Tauri events so the React UI can update live.

When a game stops running, Launchy waits for several missed checks before marking it installed again and adding the elapsed session time to the playtime total.

## Privacy and Safety

Launchy is designed as a local launcher shell:

- It does not scrape account credentials.
- It does not bypass DRM.
- It does not inject into games.
- It does not read process memory.
- It does not replace Steam or Epic authentication.
- It does not require a network service for the core library features.

Steam and Epic ownership, authentication, updates, and DRM remain handled by their official clients.

## Troubleshooting

### Steam games are missing

- Start Steam at least once so its library configuration exists.
- Use Settings to add a secondary Steam library folder manually.
- Make sure the selected folder contains a `steamapps` directory or is the `steamapps` directory itself.

### Epic games are missing

- Make sure Epic Games Launcher is installed and has created `.item` manifest files.
- Check that Launchy can read `C:\ProgramData\Epic\EpicGamesLauncher\Data\Manifests`.
- Use Settings to register a custom Epic manifest directory if your setup differs.

### A manual game will not launch

- Confirm that the selected executable still exists.
- Check whether the game requires a working directory, launcher, or special arguments.
- Re-add the game if the install folder has moved.

### Artwork does not appear

- For local files, use an absolute file path.
- For remote images, use a full `http://` or `https://` URL.
- Supported image types in the file picker include PNG, JPG, JPEG, WebP, and GIF.

## Current Limitations

- Windows is the best-supported platform right now.
- Epic detection currently relies on local manifest files.
- Manual launch argument parsing is simple whitespace splitting.
- There is no packaged release workflow documented yet.

## Roadmap Ideas

- **Advanced Metadata Integrations**: Support online scraping from APIs like SteamGridDB or IGDB for Epic Games and manual standalone titles.
- **Library Database Backup**: Create import/export utilities for backing up or migrating user SQLite `launchy.db` entries.
- **Cross-Platform Scanners**: Expand directory/registry-equivalent scanning modules for macOS and Linux operating systems.
- **CI/CD Build Automation**: Configure GitHub Actions to automatically build, package, and release signed installers (`.msi`, `.dmg`, `.deb`).
- **Additional Launcher Support**: Support scanning for GOG Galaxy, Ubisoft Connect, EA App, and itch.io games.

## Contributing

This project is early, so small, focused changes are easiest to review. Good first areas include:

- README and setup documentation.
- Scanner reliability improvements.
- UI polish for empty/error states.
- Tests around Rust parsing and database behavior.
- Tauri app metadata cleanup.

Before opening a change, run:

```bash
npm run build
```

For backend changes, also run the Tauri app locally:

```bash
npm run tauri dev
```

## License

Launchy is licensed under the GNU General Public License v3.0. See [LICENSE](LICENSE) for the full license text.

Copyright (C) 2026 Aryel
