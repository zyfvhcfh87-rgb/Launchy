import React from "react";
import { Game } from "../types/game";
import { LayoutGrid, Heart, EyeOff, Settings, Sparkles, Flame, Clock, Gamepad, Award } from "lucide-react";

interface SidebarProps {
  games: Game[];
  activeFilter: string;
  setActiveFilter: (filter: string) => void;
  showHidden: boolean;
  setShowHidden: (show: boolean) => void;
  activeTab: "library" | "settings" | "stats" | "tv";
  setActiveTab: (tab: "library" | "settings" | "stats" | "tv") => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  games,
  activeFilter,
  setActiveFilter,
  showHidden,
  setShowHidden,
  activeTab,
  setActiveTab,
}) => {
  // Stats
  const visibleGames = games.filter(g => !g.hidden);
  const totalGamesCount = visibleGames.length;
  const favoriteCount = visibleGames.filter(g => g.favorite).length;
  const totalPlaytimeSeconds = visibleGames.reduce((acc, curr) => acc + curr.playtime_seconds, 0);
  const totalPlaytimeHours = Math.round(totalPlaytimeSeconds / 3600);

  const steamCount = visibleGames.filter(g => g.source === "steam").length;
  const epicCount = visibleGames.filter(g => g.source === "epic").length;
  const gogCount = visibleGames.filter(g => g.source === "gog").length;
  const uplayCount = visibleGames.filter(g => g.source === "uplay").length;
  const eaCount = visibleGames.filter(g => g.source === "ea").length;
  const itchCount = visibleGames.filter(g => g.source === "itch").length;
  const manualCount = visibleGames.filter(g => g.source === "manual").length;

  const filters = [
    { id: "all", label: "All Games", icon: <LayoutGrid className="w-4 h-4" />, count: totalGamesCount },
    {
      id: "steam",
      label: "Steam",
      icon: (
        <svg className="w-4 h-4 text-sky-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 .007c-6.19 0-11.28 4.757-11.91 10.838l6.39 2.64c.54-.37 1.19-.59 1.9-.59h.06l2.87-4.14V8.69a3.78 3.78 0 1 1 3.78 3.78h-.06l-4.14 2.87v.06c0 .87-.3 1.66-.82 2.3l2.64 6.39c6.08-.63 10.84-5.72 10.84-11.91C23.28 5.378 18.19.007 12 .007zm-3.6 13.91a1.2 1.2 0 1 1-1.2-1.2 1.2 1.2 0 0 1 1.2 1.2zm6.72-5.7a1.68 1.68 0 1 1-1.68 1.68 1.68 1.68 0 0 1 1.68-1.68z" />
        </svg>
      ),
      count: steamCount,
    },
    {
      id: "epic",
      label: "Epic Games",
      icon: (
        <svg className="w-4 h-4 text-neutral-100" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0L1.5 3.9v12.2L12 24l10.5-7.9V3.9L12 0zm7.8 15.6l-7.8 5.9-7.8-5.9V4.9l7.8-2.9 7.8 2.9v10.7zm-7.8-11.8c-2.3 0-4.1 1.8-4.1 4.1s1.8 4.1 4.1 4.1 4.1-1.8 4.1-4.1-1.8-4.1-4.1-4.1z" />
        </svg>
      ),
      count: epicCount,
    },
    {
      id: "gog",
      label: "GOG Galaxy",
      icon: (
        <svg className="w-4 h-4 text-purple-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm-1.8 4.8h3.6v1.8h-1.8v1.8h1.8v1.8h-3.6V4.8zm0 5.4h3.6v1.8h-1.8v1.8h1.8v1.8h-3.6v-5.4zm0 5.4h3.6v1.8h-1.8v1.8h1.8v1.8h-3.6v-5.4z" />
        </svg>
      ),
      count: gogCount,
    },
    {
      id: "uplay",
      label: "Ubisoft Connect",
      icon: (
        <svg className="w-4 h-4 text-cyan-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 18c-3.313 0-6-2.687-6-6s2.687-6 6-6 6 2.687 6 6-2.687 6-6 6z" />
        </svg>
      ),
      count: uplayCount,
    },
    {
      id: "ea",
      label: "EA App",
      icon: (
        <svg className="w-4 h-4 text-orange-500" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0a12 12 0 1 0 12 12A12 12 0 0 0 12 0zm3 15h-6v-2h6v2zm0-4h-6V9h6v2z" />
        </svg>
      ),
      count: eaCount,
    },
    {
      id: "itch",
      label: "itch.io",
      icon: (
        <svg className="w-4 h-4 text-rose-500" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0L2.1 4.5v11.7L12 24l9.9-7.8V4.5L12 0zm5.4 14.4h-3.6v3.6h-3.6v-3.6H6.6v-3.6h3.6V7.2h3.6v3.6h3.6v3.6z" />
        </svg>
      ),
      count: itchCount,
    },
    {
      id: "manual",
      label: "Manual Additions",
      icon: (
        <svg className="w-4 h-4 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="6" width="20" height="12" rx="2" /><path d="M6 12h4M8 10v4M15 11h.01M18 13h.01" />
        </svg>
      ),
      count: manualCount,
    },
    { id: "favorites", label: "Favorites", icon: <Heart className="w-4 h-4 text-rose-500 fill-current" />, count: favoriteCount },
  ];

  return (
    <aside className="w-64 glass-panel border-r border-slate-800/60 flex flex-col h-screen select-none">
      {/* Brand Header */}
      <div className="p-6 flex items-center space-x-3 border-b border-slate-800/40">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-900/30">
          <Flame className="w-5 h-5 text-white animate-pulse" />
        </div>
        <div>
          <h1 className="font-extrabold text-lg bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent tracking-wide">
            LAUNCHY
          </h1>
          <p className="text-[10px] text-textMuted font-bold uppercase tracking-widest leading-none">
            Game Center
          </p>
        </div>
      </div>

      {/* Main Tabs Selection */}
      <div className="p-3 flex space-x-1 border-b border-slate-800/20 bg-slate-950/20">
        <button
          onClick={() => setActiveTab("library")}
          className={`flex-1 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all duration-200 ${
            activeTab === "library"
              ? "bg-slate-800 text-white shadow-inner"
              : "text-textMuted hover:text-white"
          }`}
        >
          Library
        </button>
        <button
          onClick={() => setActiveTab("stats")}
          className={`flex-1 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all duration-200 ${
            activeTab === "stats"
              ? "bg-slate-800 text-white shadow-inner"
              : "text-textMuted hover:text-white"
          }`}
        >
          Stats
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`flex-1 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all duration-200 ${
            activeTab === "settings"
              ? "bg-slate-800 text-white shadow-inner"
              : "text-textMuted hover:text-white"
          }`}
        >
          System
        </button>
      </div>

      {/* Navigation / Filters */}
      <div className="flex-grow overflow-y-auto px-3 py-4 space-y-6">
        {activeTab === "library" ? (
          <div>
            <span className="px-3 text-[10px] uppercase font-bold text-textMuted/60 tracking-wider">
              Collections
            </span>
            <div className="mt-2 space-y-1">
              {filters.map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold tracking-wide transition-all duration-200 ${
                    activeFilter === filter.id
                      ? "bg-gradient-to-r from-blue-600/30 to-purple-600/10 text-white border-l-2 border-blue-500 shadow-sm"
                      : "text-textMuted hover:bg-slate-900/60 hover:text-white border-l-2 border-transparent"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    {filter.icon}
                    <span>{filter.label}</span>
                  </div>
                  <span className="text-xs text-textMuted/60 bg-slate-950/60 px-2 py-0.5 rounded-md font-bold">
                    {filter.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Hidden Games Toggle */}
            <div className="mt-6 border-t border-slate-800/20 pt-4">
              <button
                onClick={() => setShowHidden(!showHidden)}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  showHidden
                    ? "bg-slate-900/60 text-slate-100"
                    : "text-textMuted hover:bg-slate-900/60 hover:text-white"
                }`}
              >
                <EyeOff className="w-4 h-4" />
                <span>Show Hidden ({games.filter(g => g.hidden).length})</span>
              </button>
            </div>
          </div>
        ) : activeTab === "stats" ? (
          <div>
            <span className="px-3 text-[10px] uppercase font-bold text-textMuted/60 tracking-wider">
              Analytics
            </span>
            <div className="mt-2 space-y-1">
              <button
                onClick={() => setActiveTab("stats")}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  activeTab === "stats"
                    ? "bg-slate-800 text-white"
                    : "text-textMuted hover:bg-slate-900/60 hover:text-white"
                }`}
              >
                <Award className="w-4 h-4 text-purple-400" />
                <span>Habits & Playtime</span>
              </button>
            </div>
          </div>
        ) : (
          <div>
            <span className="px-3 text-[10px] uppercase font-bold text-textMuted/60 tracking-wider">
              Control Panel
            </span>
            <div className="mt-2 space-y-1">
              <button
                onClick={() => setActiveTab("settings")}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  activeTab === "settings"
                    ? "bg-slate-800 text-white"
                    : "text-textMuted hover:bg-slate-900/60 hover:text-white"
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>System Settings</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* TV Mode Activation Button */}
      <div className="px-4 pb-4">
        <button
          onClick={() => setActiveTab("tv")}
          className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-xs font-extrabold uppercase tracking-wider text-white shadow-lg shadow-indigo-950/50 transition-all active:scale-95 duration-100 cursor-pointer"
        >
          <Gamepad className="w-4 h-4" />
          <span>Launch TV Mode</span>
        </button>
      </div>

      {/* Library Summary Stats Footer */}
      <div className="p-4 bg-slate-950/40 border-t border-slate-800/40 select-none">
        <div className="flex items-center space-x-3 text-xs mb-3">
          <Clock className="w-4 h-4 text-purple-400" />
          <div>
            <p className="text-[10px] uppercase text-textMuted font-bold tracking-wider leading-none">
              Total Playtime
            </p>
            <p className="text-sm font-bold text-slate-200 mt-0.5">{totalPlaytimeHours} Hrs</p>
          </div>
        </div>
        <div className="flex items-center space-x-3 text-xs">
          <Sparkles className="w-4 h-4 text-blue-400" />
          <div>
            <p className="text-[10px] uppercase text-textMuted font-bold tracking-wider leading-none">
              Discovered
            </p>
            <p className="text-sm font-bold text-slate-200 mt-0.5">{games.length} Games</p>
          </div>
        </div>
      </div>
    </aside>
  );
};
