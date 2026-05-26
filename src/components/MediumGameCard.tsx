import React from "react";
import { Game } from "../types/game";
import { SourceBadge } from "./SourceBadge";
import { StatusButton } from "./StatusButton";
import { Heart, EyeOff, Clock, FolderOpen } from "lucide-react";
import { getArtworkUrl } from "../utils/artwork";

interface MediumGameCardProps {
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

export const MediumGameCard: React.FC<MediumGameCardProps> = ({
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
    if (hours === 0) return "< 1 hr";
    return `${hours} hrs`;
  };

  return (
    <div
      onClick={() => onSelect(game)}
      className="group relative flex flex-col bg-bgCard hover:bg-bgCardHover rounded-xl overflow-hidden cursor-pointer game-card-hover border border-slate-800/40 select-none transition-all duration-300"
    >
      {/* Quick Action buttons (floating in top-right on hover) */}
      <div className="absolute top-2 right-2 z-30 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenFolder(game.id);
          }}
          className="p-1.5 rounded-md bg-slate-950/75 text-slate-400 hover:text-blue-400 hover:bg-slate-900 backdrop-blur-md transition-all duration-150"
          title="Open Install Folder"
        >
          <FolderOpen className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(game.id);
          }}
          className={`p-1.5 rounded-md backdrop-blur-md transition-all duration-150 ${
            game.favorite
              ? "bg-rose-500/80 text-white"
              : "bg-slate-950/75 text-slate-400 hover:text-rose-400 hover:bg-slate-900"
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
          className="p-1.5 rounded-md bg-slate-950/75 text-slate-400 hover:text-white hover:bg-slate-900 backdrop-blur-md transition-all duration-150"
          title={game.hidden ? "Unhide" : "Hide"}
        >
          <EyeOff className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Persistent heart indicator if favorited */}
      {game.favorite && (
        <div className="absolute top-2 left-2 z-30 p-1.5 rounded-full bg-rose-500 text-white shadow-md shadow-rose-950/50 scale-100 group-hover:opacity-0 transition-opacity duration-200">
          <Heart className="w-2.5 h-2.5 fill-current" />
        </div>
      )}

      {/* Aspect Square Cover Art Artwork */}
      <div className="relative aspect-square w-full overflow-hidden bg-slate-950 select-none">
        {(game.artwork?.cover_path || game.artwork_path) ? (
          <img
            src={getArtworkUrl(game.artwork?.cover_path || game.artwork_path)}
            alt={game.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 absolute inset-0 z-10"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : null}

        {/* Fallback Cover */}
        <div
          className={`absolute inset-0 flex flex-col justify-between p-3.5 bg-gradient-to-br ${gradientClass} text-center z-0`}
        >
          <div className="flex-grow flex items-center justify-center">
            <span className="text-sm font-extrabold text-white/90 leading-tight tracking-wide px-1.5 drop-shadow-md select-none line-clamp-3">
              {game.title}
            </span>
          </div>
          <div className="text-[8px] uppercase font-bold tracking-widest text-white/30 border-t border-white/5 pt-1.5">
            Launchy
          </div>
        </div>

        {/* Hover Launch Action overlay */}
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-3 z-20">
          <div className="text-right">
            <SourceBadge source={game.source} size="sm" />
          </div>

          <div className="space-y-2">
            <div className="text-center">
              <h4 className="text-xs font-bold text-white line-clamp-1 mb-0.5 px-0.5">{game.title}</h4>
              <div className="flex items-center justify-center text-[10px] text-textMuted select-none">
                <Clock className="w-3 h-3 mr-1" />
                <span>{formatPlaytime(game.playtime_seconds)}</span>
              </div>
            </div>

            <StatusButton
              status={game.status}
              onClick={() => onLaunch(game.id)}
              fullWidth
              size="sm"
            />
          </div>
        </div>
      </div>

      {/* Compact Static Footer */}
      <div className="p-2.5 flex flex-col justify-between flex-grow select-none bg-bgCard border-t border-slate-800/10">
        <h3 className="font-bold text-white/90 text-xs truncate leading-tight mb-1 group-hover:text-white transition-colors duration-200">
          {game.title}
        </h3>
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-textMuted/80 truncate max-w-[65%]">{formatPlaytime(game.playtime_seconds)}</span>
          <SourceBadge source={game.source} size="sm" />
        </div>
      </div>
    </div>
  );
};
