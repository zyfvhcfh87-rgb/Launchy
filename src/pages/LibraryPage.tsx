import React from "react";
import { Game } from "../types/game";
import { SearchBar } from "../components/SearchBar";
import { GameGrid } from "../components/GameGrid";
import { PlayCircle, Sparkles } from "lucide-react";

interface LibraryPageProps {
  games: Game[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeFilter: string;
  onLaunch: (gameId: string) => void;
  onSelect: (game: Game) => void;
  onToggleFavorite: (gameId: string) => void;
  onToggleHide: (gameId: string) => void;
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
  onOpenAddModal,
}) => {
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

  const filteredGames = getFilteredGames();

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
      <header className="px-8 py-5 border-b border-slate-800/40 bg-slate-950/20 flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0 flex-shrink-0">
        <div>
          <h2 className="text-xl font-extrabold text-slate-100 tracking-wide flex items-center space-x-2">
            <PlayCircle className="w-5 h-5 text-blue-500 mr-1" />
            <span>MY LIBRARY</span>
          </h2>
          <p className="text-xs text-textMuted mt-0.5 font-semibold">
            {getFilterLabel()} &middot; {filteredGames.length} Discovered
          </p>
        </div>

        <div className="flex items-center space-x-4">
          <SearchBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
          
          <button
            onClick={onOpenAddModal}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-950/50 transition-all transform active:scale-95 flex items-center space-x-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>ADD GAME</span>
          </button>
        </div>
      </header>

      {/* Main Game Grid Section */}
      <main className="flex-grow overflow-y-auto p-8">
        <GameGrid
          games={filteredGames}
          onLaunch={onLaunch}
          onSelect={onSelect}
          onToggleFavorite={onToggleFavorite}
          onToggleHide={onToggleHide}
          onOpenAddModal={onOpenAddModal}
        />
      </main>

    </div>
  );
};
