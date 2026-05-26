# AGENTS.md

## Project Context

Launchy is a local-first desktop game launcher built with Tauri 2, React 19, TypeScript, Vite 7, Tailwind CSS 4, Rust, and SQLite through `rusqlite`.

The app unifies games from Steam, Epic Games, GOG Galaxy, Ubisoft Connect, EA App, itch.io, and manually added standalone executables into one library interface. It supports launching, local play status, playtime tracking, favorites, hidden games, artwork overrides, custom tags, TV/console mode, stats, custom scan folders, and a sandboxed plugin ecosystem.

Launchy is an early alpha. Prioritize correctness, safety, maintainability, and small focused changes over large rewrites.

The project is GPLv3 licensed.

---

## Core Product Principles

Launchy is a launcher shell on top of existing game platforms.

It must remain:

- Local-first.
- Privacy-conscious.
- User-controlled.
- Safe around user files.
- Respectful of official platform clients.
- Transparent about failures and limitations.

Launchy must not become a replacement authentication client for Steam, Epic, or other platforms.

Official clients remain responsible for:

- Account authentication.
- Ownership checks.
- DRM.
- Anti-cheat compatibility.
- Cloud saves.
- Achievements.
- Game updates.
- Platform overlays.

---

## Hard Safety Rules

Never introduce code that:

1. Reads, stores, logs, or exposes Steam/Epic/GOG/Ubisoft/EA/itch credentials.
2. Extracts authentication tokens from launcher logs, process memory, private files, or IPC.
3. Reads process memory.
4. Injects into games or platform launchers.
5. Bypasses DRM, anti-cheat, ownership checks, or official platform authentication.
6. Modifies or deletes user game files without explicit user confirmation.
7. Kills game/platform processes unless the user explicitly requested that behavior.
8. Sends local library data, file paths, play history, or user metadata to a remote service without explicit opt-in.
9. Installs app updates automatically without clear user confirmation.
10. Executes user scripts/plugins without sandboxing, clear location boundaries, and user control.

Flag any violation of these rules as high priority during reviews.

---

## Current Architecture

Repository structure:

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
|   |-- src/scanners/            # Steam, Epic, GOG, Ubisoft, EA, itch, manual logic
|   `-- tauri.conf.json          # Tauri app configuration
|-- package.json                 # Node scripts and frontend dependencies
|-- vite.config.ts               # Vite config for Tauri development
`-- README.md
```

Keep frontend, backend commands, scanner logic, launcher logic, database logic, and process monitoring logic separated.

Avoid mixing unrelated concerns in one module.

---

## Build and Test Commands

Use the commands already defined in the project.

Install dependencies:

```bash
npm install
```

Run web UI only:

```bash
npm run dev
```

Run full Tauri desktop app:

```bash
npm run tauri dev
```

Build frontend:

```bash
npm run build
```

Build desktop bundle:

```bash
npm run tauri build
```

Before marking a change complete, run the most relevant available checks.

Minimum expected check for frontend or shared changes:

```bash
npm run build
```

For backend/Tauri changes, also run or at least validate:

```bash
npm run tauri dev
```

For release or packaging changes, validate:

```bash
npm run tauri build
```

Do not claim tests, builds, or manual checks passed unless they were actually run. If a command cannot be run, say why.

---

## Review Priorities for Codex

When reviewing pull requests, focus on serious and practical issues.

High-priority review targets:

- Security and privacy violations.
- File deletion/modification risks.
- Unsafe command execution.
- Broken scanner behavior.
- Broken launcher behavior.
- Broken process tracking/playtime accounting.
- SQLite schema or migration bugs.
- App state getting stuck in incorrect status.
- Plugin sandbox escapes or unsafe plugin execution.
- Update/release logic that could install untrusted files.
- Windows-specific assumptions without clear fallback or TODOs.
- Regressions in existing library views, search, filtering, favorites, hidden games, or manual entries.

Do not nitpick harmless style preferences unless they affect maintainability or correctness.

---

## Scanner Guidelines

Launchy includes scanners for multiple platforms. Scanner changes must be conservative and fault-tolerant.

Expected behavior:

- Missing launcher installations should not be fatal.
- Missing directories should produce diagnostics, not crashes.
- Malformed manifests should be skipped with useful logging/diagnostics.
- Custom scan directories should be respected.
- Duplicate games should be handled deterministically.
- Platform-specific code should use conditional compilation or clear runtime guards.
- Windows paths should not be assumed globally if the code is meant to be cross-platform.
- Registry access must fail gracefully.

Scanner-specific concerns:

### Steam

Steam scanning may use registry-first discovery and fall back to default install paths. It should parse `libraryfolders.vdf` and `appmanifest_*.acf` files.

Review for:

- Broken VDF parsing.
- Incorrect library path handling.
- Duplicate app imports.
- Bad `steam://rungameid/<appid>` URI construction.
- Missing custom Steam library support.

### Epic Games

Epic scanning may read `.item` manifests from Epic Launcher manifest directories.

Review for:

- Broken JSON parsing.
- Incorrect install path assumptions.
- Missing manifest directory handling.
- Unsafe direct executable launching where an Epic client route is safer.
- Any attempt to extract dynamic auth tokens.

### GOG, Ubisoft, EA, itch.io

Review for:

- Registry/config parsing failures.
- Missing fallback behavior.
- Hardcoded paths without diagnostics.
- Duplicate entries across custom folders.
- Launch behavior that skips official client requirements when the game needs them.

### Manual Games

Manual game entries should use user-selected executable paths and optional arguments.

Review for:

- Unsanitized command execution.
- Broken working directory behavior.
- Missing file existence checks.
- Process signatures that are too broad.

---

## Launcher Guidelines

Prefer official platform launch mechanisms when possible.

Examples:

- Steam: use `steam://rungameid/<appid>`.
- Epic: use Epic Launcher protocol/client routing when available.
- Manual games: launch the selected executable directly.

Do not add launcher logic that intentionally avoids platform clients for DRM/auth-dependent games.

Launcher behavior should:

- Show clear errors on failure.
- Avoid silent failures.
- Avoid blocking the UI.
- Avoid panics from missing files.
- Avoid shell injection through launch arguments.
- Keep user-provided arguments separated from executable paths.
- Preserve the current working directory behavior when required.

---

## Process Monitor Guidelines

The process monitor tracks status and playtime by checking system processes.

Review changes carefully for:

- False positives from generic executable names.
- Matching by executable name only when path matching is available.
- Incorrect parent PID assumptions.
- Processes being marked running after unrelated apps start.
- Games getting stuck as `launching` or `running`.
- Session duration being double-counted.
- Playtime not being saved on app close.
- High CPU usage from aggressive polling.
- Platform-specific process APIs without fallback.

Prefer matching by:

1. Exact executable path.
2. Executable path under known install directory.
3. Expected executable name plus source metadata.
4. Parent process relationship only as supporting evidence.

Do not kill processes as part of status tracking.

---

## SQLite and Data Guidelines

Launchy stores local state in `%APPDATA%/Launchy/launchy.db` on Windows and equivalent app data directories elsewhere.

Review database changes for:

- Risk of corrupting existing user data.
- Missing migrations.
- Destructive schema changes.
- Unclear default values.
- Missing indexes for frequently queried fields.
- Broken favorite/hidden/playtime/artwork persistence.
- Incorrect path normalization.
- Concurrency issues between monitor updates and UI commands.

Do not introduce remote sync by default.

Any backup/migration code must be transactional where practical and should not delete the original database.

---

## Frontend Guidelines

The frontend uses React, TypeScript, Vite, Tailwind CSS, lucide-react, and custom CSS.

Preserve existing user-facing functionality:

- Unified library view.
- Large, Medium, and List layouts.
- Search.
- Sorting.
- Source filtering.
- Favorites.
- Hidden games.
- Details drawer.
- Settings scans.
- Manual game registration.
- Artwork overrides.
- Stats dashboard.
- TV/console mode where applicable.

Review frontend changes for:

- Broken responsiveness.
- Broken persistent preferences.
- Layout regressions in Large/Medium/List views.
- Buttons that look active but do nothing.
- Missing loading/error/empty states.
- Accessibility regressions.
- TypeScript type holes.
- Tauri-only calls breaking the Vite browser mock/fallback mode.

When running outside the Tauri shell, the UI should keep a useful mock-data fallback for browser development.

---

## Plugin System Guidelines

Launchy includes a sandboxed plugin ecosystem under:

```text
%APPDATA%/Launchy/plugins/
```

Plugins may use JavaScript or Python subprocesses.

Treat plugin-related changes as sensitive.

Review for:

- Directory traversal vulnerabilities.
- Running arbitrary files outside the plugin folder.
- Unsanitized plugin names/paths.
- Missing user consent before plugin execution.
- Blocking UI while plugins run.
- No timeout or poor subprocess handling.
- Unclear stdout/stderr parsing.
- Plugins accessing credentials or private files unexpectedly.

Plugins should be disabled by default unless the existing product behavior says otherwise.

---

## Artwork and Network Guidelines

Launchy may fetch artwork from remote CDNs and supports manual cover overrides.

Review for:

- Network failures blocking app startup.
- Unbounded downloads.
- Missing timeouts.
- Unsafe file writes.
- Path traversal from remote filenames.
- Incorrect cache invalidation.
- Sending private local library data unnecessarily.
- Broken manual artwork persistence.

Remote artwork fetching should be optional/fault-tolerant and should not be required for core launching features.

---

## Update and Release Guidelines

If update checking or self-updating is added:

- Start with manual update checks before full self-updating.
- Show the current version and latest version clearly.
- Do not auto-install updates without confirmation.
- Use signed update artifacts if implementing real self-update.
- Prefer draft GitHub releases for release automation unless explicitly told otherwise.
- Keep a manual download fallback.
- Handle offline/rate-limit/no-release cases gracefully.

Flag any update flow that downloads and executes unsigned/untrusted files.

---

## Platform Guidelines

Windows is the primary target at the moment, but the README references cross-platform scanner work.

When changing platform-sensitive code:

- Use conditional compilation where appropriate.
- Keep Windows registry code guarded.
- Do not break Linux/macOS builds with unguarded Windows-only APIs.
- Keep path handling robust.
- Avoid assuming drive letters outside Windows-specific code.
- Add clear diagnostics when a platform scanner is unsupported.

---

## Style and Change Management

Prefer:

- Small focused PRs.
- Clear function boundaries.
- Minimal rewrites.
- Explicit error handling.
- User-facing messages for recoverable failures.
- Clear TODO comments for known platform-specific assumptions.
- Type-safe models between Rust and TypeScript.
- Stable public Tauri command names unless intentionally migrating them.

Avoid:

- Large unrelated refactors.
- Silent behavior changes.
- New dependencies without justification.
- Global mutable state unless necessary.
- Panics in recoverable app paths.
- Console noise with sensitive paths or metadata.
- Changing generated lockfiles without dependency changes.

---

## PR Review Checklist

For each PR, check:

- Does it preserve the local-first design?
- Does it avoid credential/token/memory/DRM issues?
- Does it avoid modifying or deleting user game files unexpectedly?
- Does it keep Steam/Epic/platform clients responsible for auth and DRM?
- Does it handle missing launchers and missing directories gracefully?
- Does it avoid breaking manual games?
- Does it avoid breaking library layouts and persistent preferences?
- Does it avoid corrupting SQLite data?
- Does it keep process monitoring accurate and lightweight?
- Does it run the relevant build/check commands, or clearly state why not?
- Is the change focused on the PR goal?

---

## Suggested Review Comment Style

When reviewing, be direct and practical.

Good review comment style:

```text
High priority: this can mark unrelated processes as the selected game because it matches only the executable name. Please also require the executable path to be under the known install directory when available.
```

```text
Medium priority: this scanner panics when the manifest directory does not exist. Missing launchers should produce diagnostics and continue scanning other platforms.
```

```text
Low priority: this component duplicates layout logic from the existing library cards. Consider extracting the shared status badge rendering if this area changes again.
```

Avoid vague comments like:

```text
This could be better.
```

Always explain the concrete risk and the expected safer behavior.
