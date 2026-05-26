import { useState, useEffect } from "react";
import { Game, GameStatus, LibrarySource } from "./types/game";
import { Sidebar } from "./components/Sidebar";
import { LibraryPage } from "./pages/LibraryPage";
import { SettingsPage } from "./pages/SettingsPage";
import { GameDetailsPage } from "./pages/GameDetailsPage";
import { AddGameModal } from "./components/AddGameModal";
import { StatsPage } from "./pages/StatsPage";
import { TvPage } from "./pages/TvPage";

// Fallback high-fidelity mock data
const MOCK_GAMES: Game[] = [
  {
    id: "steam_730",
    source: "steam",
    source_app_id: "730",
    title: "Counter-Strike 2",
    install_path: "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Counter-Strike Global Offensive",
    launch_method: "uri",
    launch_uri: "steam://rungameid/730",
    launch_exe: "cs2.exe",
    launch_args: null,
    artwork_path: null,
    status: "installed",
    favorite: true,
    hidden: false,
    last_played_at: "2026-05-24T18:32:00Z",
    playtime_seconds: 452800,
    created_at: "2026-05-20T00:00:00Z",
    updated_at: "2026-05-24T18:32:00Z",
  },
  {
    id: "epic_fn",
    source: "epic",
    source_app_id: "Fortnite",
    title: "Fortnite",
    install_path: "C:\\Program Files\\Epic Games\\Fortnite",
    launch_method: "uri",
    launch_uri: "com.epicgames.launcher://apps/Fortnite?action=launch&silent=true",
    launch_exe: "FortniteClient-Win64-Shipping.exe",
    launch_args: null,
    artwork_path: null,
    status: "installed",
    favorite: false,
    hidden: false,
    last_played_at: "2026-05-21T14:15:00Z",
    playtime_seconds: 284100,
    created_at: "2026-05-20T00:00:00Z",
    updated_at: "2026-05-21T14:15:00Z",
  },
  {
    id: "steam_105600",
    source: "steam",
    source_app_id: "105600",
    title: "Terraria",
    install_path: "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Terraria",
    launch_method: "uri",
    launch_uri: "steam://rungameid/105600",
    launch_exe: "Terraria.exe",
    launch_args: null,
    artwork_path: null,
    status: "running",
    favorite: true,
    hidden: false,
    last_played_at: "2026-05-25T02:00:00Z",
    playtime_seconds: 145000,
    created_at: "2026-05-20T00:00:00Z",
    updated_at: "2026-05-25T02:00:00Z",
  },
  {
    id: "manual_mc",
    source: "manual",
    source_app_id: null,
    title: "Minecraft Standalone",
    install_path: "C:\\Games\\Minecraft",
    launch_method: "exec",
    launch_uri: null,
    launch_exe: "MinecraftLauncher.exe",
    launch_args: "--workDir C:\\Games\\Minecraft\\.minecraft",
    artwork_path: null,
    status: "installed",
    favorite: false,
    hidden: false,
    last_played_at: "2026-05-18T20:45:00Z",
    playtime_seconds: 1204800,
    created_at: "2026-05-20T00:00:00Z",
    updated_at: "2026-05-18T20:45:00Z",
  },
  {
    id: "steam_1145360",
    source: "steam",
    source_app_id: "1145360",
    title: "Hades II",
    install_path: "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Hades II",
    launch_method: "uri",
    launch_uri: "steam://rungameid/1145360",
    launch_exe: "Hades2.exe",
    launch_args: null,
    artwork_path: null,
    status: "installed",
    favorite: true,
    hidden: false,
    last_played_at: null,
    playtime_seconds: 0,
    created_at: "2026-05-24T00:00:00Z",
    updated_at: "2026-05-24T00:00:00Z",
  }
];



function App() {
  const [games, setGames] = useState<Game[]>(MOCK_GAMES);
  const [activeTab, setActiveTab] = useState<"library" | "settings" | "stats" | "tv">("library");

  // Handle native HTML5 Fullscreen matching with activeTab === "tv"
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && activeTab === "tv") {
        setActiveTab("library");
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    if (activeTab === "tv") {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error("Failed to request fullscreen:", err);
      });
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch((err) => {
          console.error("Failed to exit fullscreen:", err);
        });
      }
    }

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [activeTab]);
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showHidden, setShowHidden] = useState(false);

  // Modals / Details Overlays
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  // Check if Tauri is present
  const isTauriEnv = typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__ !== undefined;

  const [sources, setSources] = useState<LibrarySource[]>(isTauriEnv ? [] : [
    {
      id: "source_steam_mock",
      source: "steam",
      detected_path: "D:\\SteamLibrary",
      enabled: true,
      last_scan_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ]);

  // Load games and library sources from backend on startup
  useEffect(() => {
    if (isTauriEnv) {
      loadGamesFromBackend();
      loadLibrarySourcesFromBackend();
    }
  }, []);

  // Set up live status change listeners from Rust process monitoring
  useEffect(() => {
    if (isTauriEnv) {
      import("@tauri-apps/api/event").then(({ listen }) => {
        const unlisten = listen<{ game_id: string; status: GameStatus }>(
          "game-status-changed",
          (event) => {
            const { game_id, status } = event.payload;
            updateLocalGameStatus(game_id, status);
          }
        );
        return () => {
          unlisten.then((fn) => fn());
        };
      });
    }
  }, []);

  const loadGamesFromBackend = async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const fetchedGames = await invoke<Game[]>("get_games");
      if (fetchedGames && fetchedGames.length > 0) {
        setGames(fetchedGames);
        setSelectedGame((curr) => {
          if (curr) {
            const updated = fetchedGames.find((g) => g.id === curr.id);
            return updated || curr;
          }
          return curr;
        });
      }
    } catch (err) {
      console.warn("Failed to load games from Tauri backend. Using Mock Fallback.", err);
    }
  };

  const updateLocalGameStatus = (gameId: string, status: GameStatus) => {
    setGames((prevGames) =>
      prevGames.map((game) => {
        if (game.id === gameId) {
          // If transitioning to running, set last_played_at to now
          const updates: Partial<Game> = { status };
          if (status === "running") {
            updates.last_played_at = new Date().toISOString();
          }
          return { ...game, ...updates };
        }
        return game;
      })
    );
    
    // Update active drawer details if active
    setSelectedGame((curr) => {
      if (curr && curr.id === gameId) {
        const updates: Partial<Game> = { status };
        if (status === "running") {
          updates.last_played_at = new Date().toISOString();
        }
        return { ...curr, ...updates };
      }
      return curr;
    });
  };

  // Commands Routing
  const handleLaunchGame = async (gameId: string) => {
    // Optimistic UI updates
    updateLocalGameStatus(gameId, "launching");

    if (isTauriEnv) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("launch_game", { gameId });
      } catch (err) {
        console.error("Failed to launch game via Tauri backend:", err);
        updateLocalGameStatus(gameId, "error");
      }
    } else {
      // Mock Launcher behaviour
      setTimeout(() => {
        updateLocalGameStatus(gameId, "running");
        
        // Mock game closure after 8 seconds
        setTimeout(() => {
          updateLocalGameStatus(gameId, "installed");
          // Add random playtime
          setGames(prev => prev.map(g => {
            if (g.id === gameId) {
              return {
                ...g,
                playtime_seconds: g.playtime_seconds + 120, // Add 2 minutes
                last_played_at: new Date().toISOString()
              };
            }
            return g;
          }));
        }, 8000);
      }, 2000);
    }
  };

  const handleToggleFavorite = async (gameId: string) => {
    // Optimistic state
    setGames((prev) =>
      prev.map((g) => (g.id === gameId ? { ...g, favorite: !g.favorite } : g))
    );
    if (selectedGame && selectedGame.id === gameId) {
      setSelectedGame({ ...selectedGame, favorite: !selectedGame.favorite });
    }

    if (isTauriEnv) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("toggle_favorite", { gameId });
      } catch (err) {
        console.error("Failed to toggle favorite:", err);
      }
    }
  };

  const handleToggleHide = async (gameId: string) => {
    const game = games.find((g) => g.id === gameId);
    if (!game) return;
    const newHidden = !game.hidden;

    // Optimistic state
    setGames((prev) =>
      prev.map((g) => (g.id === gameId ? { ...g, hidden: newHidden } : g))
    );
    if (selectedGame && selectedGame.id === gameId) {
      setSelectedGame({ ...selectedGame, hidden: newHidden });
    }

    if (isTauriEnv) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("set_hidden", { gameId, hidden: newHidden });
      } catch (err) {
        console.error("Failed to set hidden state:", err);
      }
    }
  };

  const loadLibrarySourcesFromBackend = async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const fetchedSources = await invoke<LibrarySource[]>("get_library_sources");
      if (fetchedSources) {
        setSources(fetchedSources);
      }
    } catch (err) {
      console.warn("Failed to load library sources from Tauri backend.", err);
    }
  };

  const handleAddLibrarySource = async (source: string, path: string) => {
    if (isTauriEnv) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const newSrc = await invoke<LibrarySource>("add_library_source", { source, path });
        setSources((prev) => [...prev, newSrc]);
        
        // Auto rescan when adding a new directory!
        handleScanLibraries();
      } catch (err) {
        console.error("Failed to add library source:", err);
        alert(typeof err === "string" ? err : "Failed to add library source. Verify folder path exists.");
      }
    } else {
      const mockSrc: LibrarySource = {
        id: `source_${source}_${Date.now()}`,
        source,
        detected_path: path,
        enabled: true,
        last_scan_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setSources((prev) => [...prev, mockSrc]);
    }
  };

  const handleRemoveLibrarySource = async (id: string) => {
    setSources((prev) => prev.filter((s) => s.id !== id));

    if (isTauriEnv) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("remove_library_source", { id });
      } catch (err) {
        console.error("Failed to remove library source:", err);
      }
    }
  };

  const handleScanLibraries = async () => {
    setIsScanning(true);
    if (isTauriEnv) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const newlyDiscovered = await invoke<Game[]>("scan_libraries");
        if (newlyDiscovered) {
          setGames(newlyDiscovered);
        }
      } catch (err) {
        console.error("Failed to scan libraries:", err);
      } finally {
        setIsScanning(false);
      }
    } else {
      // Mock scan delay
      setTimeout(() => {
        setIsScanning(false);
      }, 3000);
    }
  };

  const handleAddManualGame = async (gameData: {
    title: string;
    exePath: string;
    args: string;
    artworkPath: string;
    runnerType?: string;
    runnerPath?: string;
    runnerPrefix?: string;
  }) => {
    const separator = gameData.exePath.includes("/") ? "/" : "\\";
    const lastSepIndex = gameData.exePath.lastIndexOf(separator);
    const installPath = lastSepIndex !== -1 ? gameData.exePath.substring(0, lastSepIndex) : "";
    const launchExe = lastSepIndex !== -1 ? gameData.exePath.substring(lastSepIndex + 1) : gameData.exePath;

    const newGame: Game = {
      id: `manual_${Date.now()}`,
      source: "manual",
      source_app_id: null,
      title: gameData.title,
      install_path: installPath || null,
      launch_method: "exec",
      launch_uri: null,
      launch_exe: launchExe,
      launch_args: gameData.args || null,
      artwork_path: gameData.artworkPath || null,
      status: "installed",
      favorite: false,
      hidden: false,
      last_played_at: null,
      playtime_seconds: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      runner_type: gameData.runnerType || "native",
      runner_path: gameData.runnerPath || null,
      runner_prefix: gameData.runnerPrefix || null,
    };

    setGames((prev) => [newGame, ...prev]);

    if (isTauriEnv) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("add_manual_game", {
          title: gameData.title,
          exePath: gameData.exePath,
          args: gameData.args,
          artworkPath: gameData.artworkPath,
          runnerType: gameData.runnerType || "native",
          runnerPath: gameData.runnerPath || null,
          runnerPrefix: gameData.runnerPrefix || null,
        });
        
        // Auto-sideload manual games directly to Steam if enabled
        const autoSideloadVal = await invoke<string | null>("get_setting", { key: "steam_autosideload" });
        if (autoSideloadVal === "true") {
          try {
            await invoke("sideload_manual_games_to_steam");
            console.log("Auto-sideloaded manual game to Steam successfully!");
          } catch (sideloadErr) {
            console.error("Failed to auto-sideload manual game to Steam:", sideloadErr);
          }
        }

        loadGamesFromBackend();

      } catch (err) {
        console.error("Failed to persist manual game:", err);
      }
    }
  };

  const handleOpenFolder = async (gameId: string) => {
    if (isTauriEnv) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("open_install_folder", { gameId });
      } catch (err) {
        console.error("Failed to open install folder:", err);
        alert(typeof err === "string" ? err : "Failed to open install folder. Path might be missing or invalid.");
      }
    } else {
      alert(`Mock action: Open installation folder for game ID ${gameId}`);
    }
  };

  const handleOpenClient = async (gameId: string) => {
    if (isTauriEnv) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("open_source_client", { gameId });
      } catch (err) {
        console.error("Failed to open official client:", err);
      }
    } else {
      alert(`Mock action: Open platform client for game ID ${gameId}`);
    }
  };

  const handleUpdateArtwork = async (gameId: string, artworkPath: string | null) => {
    // Optimistic state
    setGames((prev) =>
      prev.map((g) => (g.id === gameId ? { ...g, artwork_path: artworkPath } : g))
    );
    if (selectedGame && selectedGame.id === gameId) {
      setSelectedGame({ ...selectedGame, artwork_path: artworkPath });
    }

    if (isTauriEnv) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("set_game_artwork", { gameId, artworkPath });
      } catch (err) {
        console.error("Failed to set game artwork:", err);
      }
    }
  };

  // Filter out hidden games unless showHidden toggle is active
  const filteredLibrary = games.filter((g) => showHidden || !g.hidden);

  if (activeTab === "tv") {
    return (
      <TvPage
        games={games}
        onLaunch={handleLaunchGame}
        onToggleFavorite={handleToggleFavorite}
        onExit={() => setActiveTab("library")}
      />
    );
  }

  return (
    <div className="flex h-screen w-screen bg-bgDark text-white font-sans overflow-hidden select-none">
      
      {/* Left Sidebar */}
      <Sidebar
        games={games}
        activeFilter={activeFilter}
        setActiveFilter={setActiveFilter}
        showHidden={showHidden}
        setShowHidden={setShowHidden}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Main Content Area */}
      {activeTab === "library" ? (
        <LibraryPage
          games={filteredLibrary}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          activeFilter={activeFilter}
          onLaunch={handleLaunchGame}
          onSelect={setSelectedGame}
          onToggleFavorite={handleToggleFavorite}
          onToggleHide={handleToggleHide}
          onOpenFolder={handleOpenFolder}
          onOpenAddModal={() => setIsAddModalOpen(true)}
        />
      ) : activeTab === "stats" ? (
        <StatsPage
          games={games}
          onRefreshLibrary={loadGamesFromBackend}
        />
      ) : (
        <SettingsPage
          sources={sources}
          isScanning={isScanning}
          onScanLibraries={handleScanLibraries}
          onOpenAddModal={() => setIsAddModalOpen(true)}
          onAddSource={handleAddLibrarySource}
          onRemoveSource={handleRemoveLibrarySource}
          onRefreshLibrary={loadGamesFromBackend}
        />
      )}

      {/* Modals & Slide-overs */}
      <GameDetailsPage
        game={selectedGame}
        onClose={() => setSelectedGame(null)}
        onLaunch={handleLaunchGame}
        onToggleFavorite={handleToggleFavorite}
        onToggleHide={handleToggleHide}
        onOpenFolder={handleOpenFolder}
        onOpenClient={handleOpenClient}
        onUpdateArtwork={handleUpdateArtwork}
        onRefreshLibrary={loadGamesFromBackend}
      />

      <AddGameModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddGame={handleAddManualGame}
      />

    </div>
  );
}

export default App;
