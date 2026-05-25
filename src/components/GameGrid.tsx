import React from "react";
import { Game } from "../types/game";
import { GameCard } from "./GameCard";
import { Ghost, Sparkles } from "lucide-react";

interface GameGridProps {
  games: Game[];
  onLaunch: (gameId: string) => void;
  onSelect: (game: Game) => void;
  onToggleFavorite: (gameId: string) => void;
  onToggleHide: (gameId: string) => void;
  onOpenFolder: (gameId: string) => void;
  onOpenAddModal?: () => void;
}

export const GameGrid: React.FC<GameGridProps> = ({
  games,
  onLaunch,
  onSelect,
  onToggleFavorite,
  onToggleHide,
  onOpenFolder,
  onOpenAddModal,
}) => {
  if (games.length === 0) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center py-20 px-6 text-center select-none animate-in fade-in duration-300">
        <div className="w-16 h-16 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-center text-slate-500 mb-4 shadow-inner">
          <Ghost className="w-8 h-8 text-textMuted" />
        </div>
        <h3 className="text-lg font-bold text-slate-200">No games found</h3>
        <p className="text-sm text-textMuted mt-1 max-w-sm">
          Try expanding your search query, changing filters, or scanning for new library folders.
        </p>
        {onOpenAddModal && (
          <button
            onClick={onOpenAddModal}
            className="mt-6 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700/60 text-xs font-bold rounded-xl transition-all flex items-center space-x-2"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>ADD FIRST GAME MANUALLY</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 select-none animate-in fade-in duration-300">
      {games.map((game) => (
        <GameCard
          key={game.id}
          game={game}
          onLaunch={onLaunch}
          onSelect={onSelect}
          onToggleFavorite={onToggleFavorite}
          onToggleHide={onToggleHide}
          onOpenFolder={onOpenFolder}
        />
      ))}
    </div>
  );
};
