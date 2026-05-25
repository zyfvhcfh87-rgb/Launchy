import React from "react";
import { Game } from "../types/game";
import { SourceBadge } from "./SourceBadge";
import { StatusButton } from "./StatusButton";
import { Heart, EyeOff, Clock } from "lucide-react";
import { getArtworkUrl } from "../utils/artwork";

interface GameCardProps {
  game: Game;
  onLaunch: (gameId: string) => void;
  onSelect: (game: Game) => void;
  onToggleFavorite: (gameId: string) => void;
  onToggleHide: (gameId: string) => void;
}

// Generate beautiful deterministic gradients based on game title
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

export const GameCard: React.FC<GameCardProps> = ({
  game,
  onLaunch,
  onSelect,
  onToggleFavorite,
  onToggleHide,
}) => {
  const gradientClass = generateGradient(game.title);

  // Format playtime
  const formatPlaytime = (seconds: number) => {
    if (seconds <= 0) return "Never Played";
    const hours = Math.round(seconds / 3600);
    if (hours === 0) return "Played < 1 hr";
    return `${hours} hrs played`;
  };

  return (
    <div
      onClick={() => onSelect(game)}
      className="group relative flex flex-col bg-bgCard hover:bg-bgCardHover rounded-xl overflow-hidden cursor-pointer game-card-hover border border-slate-800/40"
    >
      {/* Favorite badge & hide quick actions */}
      <div className="absolute top-2.5 right-2.5 z-10 flex space-x-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(game.id);
          }}
          className={`p-2 rounded-lg backdrop-blur-md transition-all duration-200 ${
            game.favorite
              ? "bg-rose-500/80 text-white"
              : "bg-slate-950/60 text-slate-400 hover:text-rose-400 hover:bg-slate-900/80"
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
          className="p-2 rounded-lg bg-slate-950/60 text-slate-400 hover:text-white hover:bg-slate-900/80 backdrop-blur-md transition-all duration-200"
          title={game.hidden ? "Unhide" : "Hide"}
        >
          <EyeOff className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Persistent heart if favorited */}
      {game.favorite && (
        <div className="absolute top-2.5 left-2.5 z-10 p-1.5 rounded-full bg-rose-500 text-white shadow-md shadow-rose-950/50 scale-100 group-hover:opacity-0 transition-opacity duration-200">
          <Heart className="w-3 h-3 fill-current" />
        </div>
      )}

      {/* Cover Artwork Container */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-950 select-none">
        {game.artwork_path ? (
          <img
            key={game.artwork_path}
            src={getArtworkUrl(game.artwork_path)}
            alt={game.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 absolute inset-0 z-10"
            onError={(e) => {
              // Fallback to title-based placeholder
              e.currentTarget.style.display = "none";
            }}
          />
        ) : null}

        {/* Title-based Fallback Cover */}
        <div
          className={`absolute inset-0 flex flex-col justify-between p-4 bg-gradient-to-br ${gradientClass} text-center z-0`}
        >
          <div className="flex-grow flex items-center justify-center">
            <span className="text-xl font-extrabold text-white/90 leading-tight tracking-wide px-2 drop-shadow-md select-none">
              {game.title}
            </span>
          </div>
          <div className="text-[10px] uppercase font-bold tracking-widest text-white/40 border-t border-white/5 pt-2">
            Launchy
          </div>
        </div>

        {/* Hover Launch Overlay Overlay */}
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-4">
          <div className="text-right">
            <SourceBadge source={game.source} size="sm" />
          </div>

          <div className="space-y-4">
            <div className="text-center">
              <h4 className="text-sm font-bold text-white line-clamp-2 px-1 mb-1">{game.title}</h4>
              <div className="flex items-center justify-center text-xs text-textMuted select-none">
                <Clock className="w-3.5 h-3.5 mr-1" />
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

      {/* Static Info Footer (visible when not hovered) */}
      <div className="p-3.5 flex flex-col justify-between flex-grow select-none">
        <h3 className="font-semibold text-white/90 text-sm truncate leading-tight mb-1.5 group-hover:text-white transition-colors duration-200">
          {game.title}
        </h3>
        <div className="flex items-center justify-between text-xs">
          <span className="text-textMuted truncate max-w-[60%]">{formatPlaytime(game.playtime_seconds)}</span>
          <SourceBadge source={game.source} size="sm" />
        </div>
      </div>
    </div>
  );
};
