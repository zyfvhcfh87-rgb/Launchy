import React, { useState, useEffect } from "react";
import { Game } from "../types/game";
import { SourceBadge } from "../components/SourceBadge";
import { StatusButton } from "../components/StatusButton";
import { X, Heart, EyeOff, FolderOpen, PlaySquare, Calendar, Clock, ChevronRight, Image as ImageIcon, Trash2, Check } from "lucide-react";
import { getArtworkUrl } from "../utils/artwork";

interface GameDetailsPageProps {
  game: Game | null;
  onClose: () => void;
  onLaunch: (gameId: string) => void;
  onToggleFavorite: (gameId: string) => void;
  onToggleHide: (gameId: string) => void;
  onOpenFolder: (gameId: string) => void;
  onOpenClient: (gameId: string) => void;
  onUpdateArtwork: (gameId: string, artworkPath: string | null) => void;
}

const generateGradient = (title: string) => {
  const gradients = [
    "from-purple-900/60 to-indigo-950/90",
    "from-slate-900/60 to-blue-950/90",
    "from-emerald-950/60 to-teal-900/90",
    "from-rose-950/60 to-slate-950/90",
    "from-blue-950/60 to-violet-950/90",
    "from-amber-950/60 to-stone-900/90",
    "from-cyan-950/60 to-indigo-950/90",
  ];
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
};

export const GameDetailsPage: React.FC<GameDetailsPageProps> = ({
  game,
  onClose,
  onLaunch,
  onToggleFavorite,
  onToggleHide,
  onOpenFolder,
  onOpenClient,
  onUpdateArtwork,
}) => {
  if (!game) return null;

  const [artworkInput, setArtworkInput] = useState("");
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (game) {
      setArtworkInput(game.artwork_path || "");
      setIsSaved(false);
    }
  }, [game?.id, game?.artwork_path]);

  const handleBrowseArtwork = async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const selected = await invoke<string | null>("select_file", {
        title: "Select Game Cover Image",
        filterName: "Images",
        extensions: ["png", "jpg", "jpeg", "webp", "gif"]
      });
      if (selected) {
        setArtworkInput(selected);
        // Automatically save and apply immediately!
        onUpdateArtwork(game.id, selected);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
      }
    } catch (err) {
      console.error("Failed to open file browser:", err);
    }
  };

  const handleSaveArtwork = () => {
    if (!game) return;
    const value = artworkInput.trim() || null;
    onUpdateArtwork(game.id, value);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleClearArtwork = () => {
    if (!game) return;
    onUpdateArtwork(game.id, null);
    setArtworkInput("");
    setIsSaved(false);
  };

  const gradientClass = generateGradient(game.title);

  const formatPlaytime = (seconds: number) => {
    if (seconds <= 0) return "0 hours";
    const hours = Math.round((seconds / 3600) * 10) / 10;
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/70 backdrop-blur-sm select-none animate-in fade-in duration-200">
      {/* Click outside to close */}
      <div className="flex-grow" onClick={onClose} />

      {/* Drawer */}
      <div className="w-full max-w-lg bg-bgPanel border-l border-slate-800/80 h-full flex flex-col shadow-2xl relative overflow-hidden animate-in slide-in-from-right duration-300">
        
        {/* Cover Art Background Blend */}
        {game.artwork_path ? (
          <div
            key={game.artwork_path}
            className="absolute top-0 inset-x-0 h-80 bg-cover bg-center opacity-20 blur-3xl -z-10 transition-all duration-300"
            style={{ backgroundImage: `url(${getArtworkUrl(game.artwork_path)})` }}
          />
        ) : (
          <div className={`absolute top-0 inset-x-0 h-80 bg-gradient-to-b ${gradientClass} opacity-30 blur-2xl -z-10`} />
        )}

        {/* Header */}
        <div className="p-6 border-b border-slate-800/60 flex items-center justify-between bg-slate-950/30">
          <span className="text-[10px] uppercase font-bold text-textMuted/60 tracking-widest flex items-center">
            Library <ChevronRight className="w-3 h-3 mx-1" /> Details
          </span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all duration-150"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-grow overflow-y-auto p-6 space-y-6">
          
          {/* Cover & Main Panel */}
          <div className="flex space-x-6 items-start">
            {/* Artwork */}
            <div className="w-32 aspect-[3/4] bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg relative flex-shrink-0">
              {game.artwork_path ? (
                <img
                  key={game.artwork_path}
                  src={getArtworkUrl(game.artwork_path)}
                  alt={game.title}
                  className="w-full h-full object-cover absolute inset-0 z-10"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              ) : null}
              <div className={`absolute inset-0 bg-gradient-to-br ${gradientClass} flex items-center justify-center p-2 text-center z-0`}>
                <span className="text-xs font-black text-white/80 leading-tight drop-shadow-md select-none">
                  {game.title}
                </span>
              </div>
            </div>

            {/* Title Block */}
            <div className="space-y-3.5 flex-grow">
              <SourceBadge source={game.source} size="md" />
              <h2 className="text-2xl font-extrabold text-slate-100 tracking-wide line-clamp-2">
                {game.title}
              </h2>
              <div className="flex space-x-2">
                <button
                  onClick={() => onToggleFavorite(game.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 border transition-all duration-200 ${
                    game.favorite
                      ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                      : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-500/20"
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 ${game.favorite ? "fill-current" : ""}`} />
                  <span>{game.favorite ? "FAVORITED" : "FAVORITE"}</span>
                </button>
                <button
                  onClick={() => onToggleHide(game.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 border transition-all duration-200 ${
                    game.hidden
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                      : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>{game.hidden ? "HIDDEN" : "HIDE GAME"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="bg-slate-950/40 border border-slate-800/40 rounded-xl p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-textMuted tracking-wider leading-none block">
                Launcher Status
              </span>
              <span className="text-xs text-slate-400">
                {game.status === "running" ? "Game is active" : "Installed and ready"}
              </span>
            </div>
            <StatusButton
              status={game.status}
              onClick={() => onLaunch(game.id)}
              size="md"
            />
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-900/40 border border-slate-800/40 rounded-xl p-4 flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/20 text-purple-400">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-textMuted tracking-wider leading-none">
                  Playtime
                </span>
                <p className="text-sm font-bold text-slate-200 mt-0.5">
                  {formatPlaytime(game.playtime_seconds)}
                </p>
              </div>
            </div>

            <div className="bg-slate-900/40 border border-slate-800/40 rounded-xl p-4 flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-400">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-textMuted tracking-wider leading-none">
                  Last Played
                </span>
                <p className="text-sm font-bold text-slate-200 mt-0.5 truncate max-w-[140px]">
                  {formatDate(game.last_played_at)}
                </p>
              </div>
            </div>
          </div>

          {/* Details Section */}
          <div className="space-y-4">
            <span className="text-[10px] uppercase font-bold text-textMuted/60 tracking-wider">
              Installation Details
            </span>
            
            <div className="bg-slate-900/20 border border-slate-800/60 rounded-xl divide-y divide-slate-800/40">
              <div className="p-4 flex flex-col space-y-1">
                <span className="text-[10px] uppercase font-bold text-textMuted tracking-wider">
                  Source Client
                </span>
                <span className="text-sm text-slate-300 font-semibold uppercase tracking-wide">
                  {game.source}
                </span>
              </div>

              {game.source_app_id && (
                <div className="p-4 flex flex-col space-y-1">
                  <span className="text-[10px] uppercase font-bold text-textMuted tracking-wider">
                    Application ID
                  </span>
                  <span className="text-sm text-slate-300 font-mono select-text">
                    {game.source_app_id}
                  </span>
                </div>
              )}

              {game.install_path && (
                <div className="p-4 flex flex-col space-y-1">
                  <span className="text-[10px] uppercase font-bold text-textMuted tracking-wider">
                    Install Path
                  </span>
                  <span className="text-xs text-slate-400 select-text break-all">
                    {game.install_path}
                  </span>
                </div>
              )}

              {game.launch_exe && (
                <div className="p-4 flex flex-col space-y-1">
                  <span className="text-[10px] uppercase font-bold text-textMuted tracking-wider">
                    Executable Name
                  </span>
                  <span className="text-xs text-slate-400 font-mono select-text truncate">
                    {game.launch_exe}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Custom Artwork Backdrop / Cover */}
          <div className="space-y-3.5">
            <span className="text-[10px] uppercase font-bold text-textMuted/60 tracking-wider flex items-center space-x-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-purple-400" />
              <span>Customize Cover Artwork</span>
            </span>

            <div className="bg-slate-900/40 border border-slate-800/40 rounded-xl p-4 space-y-3">
              <p className="text-xs text-slate-400 leading-relaxed">
                Enter a local image file path or a web image URL to replace the default deterministic gradient and card background.
              </p>
              
              <div className="flex flex-col space-y-3">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="e.g. C:\Users\Aryel\Pictures\deadlock.png"
                    value={artworkInput}
                    onChange={(e) => setArtworkInput(e.target.value)}
                    className="flex-grow bg-slate-950/80 border border-slate-800/60 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500/80 transition-all select-text"
                  />
                  
                  <button
                    type="button"
                    onClick={handleBrowseArtwork}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-800/60 transition-all active:scale-95 duration-100"
                  >
                    Browse...
                  </button>
                </div>
                
                <div className="flex space-x-2 justify-end">
                  <button
                    type="button"
                    onClick={handleSaveArtwork}
                    className={`px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center space-x-1 ${
                      isSaved
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40"
                        : "bg-purple-600 hover:bg-purple-500 text-white hover:shadow-purple-950/40"
                    }`}
                  >
                    {isSaved ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Saved</span>
                      </>
                    ) : (
                      <span>Save</span>
                    )}
                  </button>

                  {game.artwork_path && (
                    <button
                      type="button"
                      onClick={handleClearArtwork}
                      className="px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-rose-400 transition-all border border-slate-800/60 flex items-center justify-center space-x-1.5"
                      title="Remove custom artwork override"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Actions panel */}
          <div className="space-y-3.5">
            <span className="text-[10px] uppercase font-bold text-textMuted/60 tracking-wider">
              Utilities
            </span>
            
            <div className="flex flex-col space-y-2">
              <button
                onClick={() => onOpenFolder(game.id)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition-all text-sm font-semibold border border-slate-800/40"
              >
                <div className="flex items-center space-x-3">
                  <FolderOpen className="w-4 h-4 text-blue-400" />
                  <span>Open Installation Folder</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </button>

              {game.source !== "manual" && (
                <button
                  onClick={() => onOpenClient(game.id)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition-all text-sm font-semibold border border-slate-800/40"
                >
                  <div className="flex items-center space-x-3">
                    <PlaySquare className="w-4 h-4 text-indigo-400" />
                    <span>Open in Official Client</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                </button>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
