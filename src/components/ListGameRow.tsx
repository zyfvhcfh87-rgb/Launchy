import React from "react";
import { Game } from "../types/game";
import { SourceBadge } from "./SourceBadge";
import { StatusButton } from "./StatusButton";
import { Heart, EyeOff, Clock, FolderOpen } from "lucide-react";
import { getArtworkUrl } from "../utils/artwork";

interface ListGameRowProps {
  game: Game;
  onLaunch: (gameId: string) => void;
  onSelect: (game: Game) => void;
  onToggleFavorite: (gameId: string) => void;
  onToggleHide: (gameId: string) => void;
  onOpenFolder: (gameId: string) => void;
}

const generateGradient = (title: string) => {
  const gradients = [
    "from-purple-900 to-indigo-950",
    "from-slate-900 to-blue-950",
    "from-emerald-950 to-teal-900",
    "from-rose-950 to-slate-950",
    "from-blue-950 to-violet-950",
    "from-amber-950 to-stone-900",
    "from-cyan-950 to-indigo-950",
  ];
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
};

export const ListGameRow: React.FC<ListGameRowProps> = ({
  game,
  onLaunch,
  onSelect,
  onToggleFavorite,
  onToggleHide,
  onOpenFolder,
}) => {
  const gradientClass = generateGradient(game.title);

  const formatPlaytime = (seconds: number) => {
    if (seconds <= 0) return "Never Played";
    const hours = Math.round(seconds / 3600);
    if (hours === 0) return "Played < 1 hr";
    return `${hours} hrs played`;
  };

  const getFirstLetter = (title: string) => {
    return title.trim().charAt(0).toUpperCase();
  };

  return (
    <div
      onClick={() => onSelect(game)}
      className="group flex items-center justify-between p-3 bg-slate-900/20 hover:bg-slate-900/60 border border-slate-800/40 hover:border-slate-700/60 rounded-xl select-none cursor-pointer transition-all duration-200 gap-4"
    >
      {/* Left side: Thumbnail + Game Details */}
      <div className="flex items-center flex-grow min-w-0 pr-4">
        {/* Cover Art Thumbnail */}
        <div className="relative w-10 h-13 flex-shrink-0 bg-slate-950 rounded-lg overflow-hidden border border-slate-800/80 shadow-md">
          {(game.artwork?.cover_path || game.artwork_path) ? (
            <img
              src={getArtworkUrl(game.artwork?.cover_path || game.artwork_path)}
              alt={game.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : null}
          
          {/* Fallback Thumbnail */}
          <div className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br ${gradientClass} text-center`}>
            <span className="text-xs font-black text-white/95">
              {getFirstLetter(game.title)}
            </span>
          </div>

          {/* Favorite Indicator Overlay */}
          {game.favorite && (
            <div className="absolute top-1 left-1 z-10 p-0.5 rounded-full bg-rose-500 text-white">
              <Heart className="w-1.5 h-1.5 fill-current" />
            </div>
          )}
        </div>

        {/* Game Info Details */}
        <div className="ml-3.5 flex-grow min-w-0">
          <div className="flex items-center space-x-2">
            <h3 className="font-bold text-sm text-slate-200 group-hover:text-white transition-colors duration-200 truncate">
              {game.title}
            </h3>
            {game.favorite && (
              <Heart className="w-3.5 h-3.5 text-rose-500 fill-current flex-shrink-0" />
            )}
          </div>
          <div className="flex items-center text-xs text-textMuted space-x-1.5 mt-0.5">
            <Clock className="w-3 h-3 text-textMuted/70" />
            <span>{formatPlaytime(game.playtime_seconds)}</span>
          </div>
        </div>
      </div>

      {/* Middle side: Source platform */}
      <div className="flex-shrink-0">
        <SourceBadge source={game.source} size="sm" />
      </div>

      {/* Right side: Actions (Hover Menu + Status/Launch Button) */}
      <div className="flex items-center space-x-4 flex-shrink-0">
        {/* Quick action buttons (appearing on hover or slightly transparent) */}
        <div className="flex space-x-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenFolder(game.id);
            }}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-blue-400 hover:bg-slate-800 transition-all duration-150"
            title="Open Install Folder"
          >
            <FolderOpen className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(game.id);
            }}
            className={`p-2 rounded-lg border transition-all duration-150 ${
              game.favorite
                ? "bg-rose-950/40 border-rose-900/30 text-rose-400"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-rose-400 hover:bg-slate-800"
            }`}
            title={game.favorite ? "Unfavorite" : "Favorite"}
          >
            <Heart className={`w-3.5 h-3.5 ${game.favorite ? "fill-current" : ""}`} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleHide(game.id);
            }}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-all duration-150"
            title={game.hidden ? "Unhide" : "Hide"}
          >
            <EyeOff className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Play / Action Launch Button */}
        <div className="w-24 sm:w-28 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <StatusButton
            status={game.status}
            onClick={() => onLaunch(game.id)}
            size="sm"
            fullWidth
          />
        </div>
      </div>
    </div>
  );
};
