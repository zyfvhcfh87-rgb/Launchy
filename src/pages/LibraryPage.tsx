import React, { useState } from "react";
import { Game } from "../types/game";
import { SearchBar } from "../components/SearchBar";
import { GameGrid } from "../components/GameGrid";
import { PlayCircle, Sparkles, ListFilter, LayoutGrid, Grid, List } from "lucide-react";

interface LibraryPageProps {
  games: Game[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeFilter: string;
  onLaunch: (gameId: string) => void;
  onSelect: (game: Game) => void;
  onToggleFavorite: (gameId: string) => void;
  onToggleHide: (gameId: string) => void;
  onOpenFolder: (gameId: string) => void;
  onOpenAddModal: () => void;
}

export const LibraryPage: React.FC<LibraryPageProps> = ({
  games,
  searchQuery,
  setSearchQuery,
  activeFilter,
  onLaunch,
  onSelect,
  onToggleFavorite,
  onToggleHide,
  onOpenFolder,
  onOpenAddModal,
}) => {
  const [sortBy, setSortBy] = useState<string>("title-az");

  const [viewMode, setViewMode] = useState<"large" | "medium" | "list">(() => {
    const saved = localStorage.getItem("launchy_library_view_mode");
    return (saved as "large" | "medium" | "list") || "large";
  });

  const handleViewModeChange = (mode: "large" | "medium" | "list") => {
    setViewMode(mode);
    localStorage.setItem("launchy_library_view_mode", mode);
  };

  // Filter games based on filter tab & search query
  const getFilteredGames = () => {
    return games.filter((game) => {
      // Search matching
      const matchesSearch = game.title.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      // Collection filter matching
      switch (activeFilter) {
        case "steam":
          return game.source === "steam";
        case "epic":
          return game.source === "epic";
        case "manual":
          return game.source === "manual";
        case "favorites":
          return game.favorite;
        case "all":
        default:
          return true;
      }
    });
  };

  const getSortedGames = (filtered: Game[]) => {
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "title-za":
          return b.title.localeCompare(a.title);

        case "favorites-first":
          if (a.favorite && !b.favorite) return -1;
          if (!a.favorite && b.favorite) return 1;
          return a.title.localeCompare(b.title);

        case "recently-played": {
          const dateA = a.last_played_at ? new Date(a.last_played_at).getTime() : 0;
          const dateB = b.last_played_at ? new Date(b.last_played_at).getTime() : 0;
          if (dateA === 0 && dateB > 0) return 1;
          if (dateA > 0 && dateB === 0) return -1;
          if (dateA === 0 && dateB === 0) return a.title.localeCompare(b.title);
          return dateB - dateA;
        }

        case "most-played": {
          const playtimeA = a.playtime_seconds || 0;
          const playtimeB = b.playtime_seconds || 0;
          if (playtimeA === 0 && playtimeB > 0) return 1;
          if (playtimeA > 0 && playtimeB === 0) return -1;
          if (playtimeA === 0 && playtimeB === 0) return a.title.localeCompare(b.title);
          return playtimeB - playtimeA;
        }

        case "platform":
          if (a.source !== b.source) {
            return a.source.localeCompare(b.source);
          }
          return a.title.localeCompare(b.title);

        case "recently-added": {
          const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;
          if (createdA === 0 && createdB > 0) return 1;
          if (createdA > 0 && createdB === 0) return -1;
          if (createdA === 0 && createdB === 0) return a.title.localeCompare(b.title);
          return createdB - createdA;
        }

        case "title-az":
        default:
          return a.title.localeCompare(b.title);
      }
    });
  };

  const filteredGames = getFilteredGames();
  const sortedGames = getSortedGames(filteredGames);

  // Get human readable collection name
  const getFilterLabel = () => {
    switch (activeFilter) {
      case "steam":
        return "Steam Library";
      case "epic":
        return "Epic Games Library";
      case "manual":
        return "Manual Entries";
      case "favorites":
        return "Favorites";
      case "all":
      default:
        return "All Installed Games";
    }
  };

  return (
    <div className="flex-grow flex flex-col h-screen overflow-hidden select-none">
      
      {/* Top Header / Filter controls */}
      <header className="px-8 py-5 border-b border-slate-800/40 bg-slate-950/20 flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0 flex-shrink-0">
        <div>
          <h2 className="text-xl font-extrabold text-slate-100 tracking-wide flex items-center space-x-2">
            <PlayCircle className="w-5 h-5 text-blue-500 mr-1" />
            <span>MY LIBRARY</span>
          </h2>
          <p className="text-xs text-textMuted mt-0.5 font-semibold">
            {getFilterLabel()} &middot; {filteredGames.length} Discovered
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-3 sm:space-y-0 sm:space-x-3.5">
          <SearchBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
          
          {/* Rich Sort Select Picker */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 focus-within:border-blue-500/80 transition-all select-none">
            <ListFilter className="w-4 h-4 text-textMuted mr-2 flex-shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent text-xs font-bold focus:outline-none text-slate-200 cursor-pointer pr-1 w-full sm:w-auto"
            >
              <option value="title-az" className="bg-slate-950 text-slate-200">Title A–Z</option>
              <option value="title-za" className="bg-slate-950 text-slate-200">Title Z–A</option>
              <option value="favorites-first" className="bg-slate-950 text-slate-200">Favorites First</option>
              <option value="recently-played" className="bg-slate-950 text-slate-200">Recently Played</option>
              <option value="most-played" className="bg-slate-950 text-slate-200">Most Played</option>
              <option value="platform" className="bg-slate-950 text-slate-200">Platform</option>
              <option value="recently-added" className="bg-slate-950 text-slate-200">Recently Added</option>
            </select>
          </div>

          {/* View Mode Toggle Switch */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 select-none flex-shrink-0">
            <button
              onClick={() => handleViewModeChange("large")}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === "large"
                  ? "bg-slate-800 text-blue-400 shadow-inner"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Large Cards View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleViewModeChange("medium")}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === "medium"
                  ? "bg-slate-800 text-blue-400 shadow-inner"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Compact Grid View"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleViewModeChange("list")}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === "list"
                  ? "bg-slate-800 text-blue-400 shadow-inner"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          
          <button
            onClick={onOpenAddModal}
            className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-950/50 transition-all transform active:scale-95 flex items-center justify-center space-x-1.5 flex-shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>ADD GAME</span>
          </button>
        </div>
      </header>

      {/* Main Game Grid Section */}
      <main className="flex-grow overflow-y-auto p-8">
        <GameGrid
          games={sortedGames}
          viewMode={viewMode}
          onLaunch={onLaunch}
          onSelect={onSelect}
          onToggleFavorite={onToggleFavorite}
          onToggleHide={onToggleHide}
          onOpenFolder={onOpenFolder}
          onOpenAddModal={onOpenAddModal}
        />
      </main>

    </div>
  );
};
