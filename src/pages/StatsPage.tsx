import React, { useMemo, useState, useEffect } from "react";
import { Game, PlaytimeSession, Category } from "../types/game";
import { Clock, Calendar, BarChart2, Tag, Plus, Trash2, HelpCircle, Flame, Gamepad2, Award } from "lucide-react";

interface StatsPageProps {
  games: Game[];
  onRefreshLibrary?: () => void;
}

export const StatsPage: React.FC<StatsPageProps> = ({ games, onRefreshLibrary }) => {
  const [sessions, setSessions] = useState<PlaytimeSession[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedGameId, setSelectedGameId] = useState("");


  const [dayTick, setDayTick] = useState(() => new Date().toDateString());

  useEffect(() => {
    const scheduleNextDayTick = () => {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 0, 0);
      const timeoutMs = nextMidnight.getTime() - now.getTime() + 1000;

      return window.setTimeout(() => {
        setDayTick(new Date().toDateString());
      }, timeoutMs);
    };

    const timeoutId = scheduleNextDayTick();
    return () => window.clearTimeout(timeoutId);
  }, [dayTick]);

  const loadStatsData = async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      
      // Load playtime sessions
      const sLogs = await invoke<PlaytimeSession[]>("get_playtime_sessions");
      setSessions(sLogs || []);

      // Load custom categories
      const cats = await invoke<Category[]>("get_all_categories");
      setCategories(cats || []);
      if (cats && cats.length > 0 && !selectedCategoryId) {
        setSelectedCategoryId(cats[0].id);
      }
    } catch (err) {
      console.error("Failed to load stats data:", err);
    } finally {
      // Done loading
    }
  };

  useEffect(() => {
    loadStatsData();
  }, []);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("create_category", { name: newCategoryName.trim() });
      setNewCategoryName("");
      await loadStatsData();
      if (onRefreshLibrary) onRefreshLibrary();
    } catch (err) {
      console.error("Failed to create category:", err);
      alert(typeof err === "string" ? err : "Category already exists or failed to create.");
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    if (!confirm("Are you sure you want to delete this category? All game tag mappings will be removed.")) return;
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("delete_category", { id: catId });
      if (selectedCategoryId === catId) {
        setSelectedCategoryId("");
      }
      await loadStatsData();
      if (onRefreshLibrary) onRefreshLibrary();
    } catch (err) {
      console.error("Failed to delete category:", err);
    }
  };

  const handleAddGameToCategory = async () => {
    if (!selectedGameId || !selectedCategoryId) return;
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("add_game_to_category", { gameId: selectedGameId, categoryId: selectedCategoryId });
      setSelectedGameId("");
      await loadStatsData();
      if (onRefreshLibrary) onRefreshLibrary();
    } catch (err) {
      console.error("Failed to map game to category:", err);
    }
  };

  const handleRemoveGameFromCategory = async (gameId: string, catId: string) => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("remove_game_from_category", { gameId, categoryId: catId });
      await loadStatsData();
      if (onRefreshLibrary) onRefreshLibrary();
    } catch (err) {
      console.error("Failed to unbind game from category:", err);
    }
  };

  // calculations
  const gameTotals = useMemo(() => {
    return games.reduce(
      (acc, game) => {
        acc.totalPlaytimeSeconds += game.playtime_seconds;
        if (game.playtime_seconds > 0) {
          acc.playedGamesCount += 1;
        }
        return acc;
      },
      { totalPlaytimeSeconds: 0, playedGamesCount: 0 }
    );
  }, [games]);

  const totalPlaytimeHours = (gameTotals.totalPlaytimeSeconds / 3600).toFixed(1);
  const playedGamesCount = gameTotals.playedGamesCount;
  
  // Weekly playtime grouping (last 7 days)
  const weeklyData = useMemo(() => {
    const days: { label: string; dateStr: string; seconds: number }[] = [];
    const now = new Date();
    
    // Create map for the last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const key = d.toLocaleDateString(undefined, { weekday: "short" });
      const dateStr = d.toISOString().split("T")[0]; // YYYY-MM-DD
      days.push({ label: key, dateStr, seconds: 0 });
    }

    sessions.forEach(session => {
      if (!session.played_at) return;
      const sDateStr = session.played_at.split("T")[0];
      const match = days.find(day => day.dateStr === sDateStr);
      if (match) {
        match.seconds += session.playtime_seconds;
      }
    });

    return days.map(d => ({
      label: d.label,
      hours: parseFloat((d.seconds / 3600).toFixed(2)),
      rawSeconds: d.seconds
    }));
  }, [sessions, dayTick]);

  const maxWeeklyHours = Math.max(...weeklyData.map(d => d.hours), 0.5); // avoid divide by zero

  // Genre analysis
  const topGenres = useMemo(() => {
    const genreMap: { [key: string]: number } = {};
    games.forEach(game => {
      if (game.genres && game.playtime_seconds > 0) {
        const list = game.genres.split(",").map(g => g.trim());
        list.forEach(g => {
          genreMap[g] = (genreMap[g] || 0) + game.playtime_seconds;
        });
      }
    });

    return Object.entries(genreMap)
      .map(([genre, seconds]) => ({
        genre,
        hours: parseFloat((seconds / 3600).toFixed(1)),
        rawSeconds: seconds
      }))
      .sort((a, b) => b.rawSeconds - a.rawSeconds)
      .slice(0, 5); // top 5
  }, [games]);

  const totalGenreSeconds = topGenres.reduce((acc, g) => acc + g.rawSeconds, 0) || 1;

  // Format playtime
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m`;
    const hrs = (seconds / 3600).toFixed(1);
    return `${hrs}h`;
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return dateStr;
    }
  };

  // Find the currently active category details
  const activeCategory = useMemo(
    () => categories.find(c => c.id === selectedCategoryId),
    [categories, selectedCategoryId]
  );

  const activeCategoryGameIds = useMemo(
    () => new Set(activeCategory?.game_ids || []),
    [activeCategory]
  );

  const gamesInCategory = useMemo(
    () => activeCategory ? games.filter(g => activeCategoryGameIds.has(g.id)) : [],
    [activeCategory, activeCategoryGameIds, games]
  );

  // Filter games not already in the active category for the dropdown
  const gamesAvailableForCategory = useMemo(
    () => activeCategory ? games.filter(g => !activeCategoryGameIds.has(g.id)) : games,
    [activeCategory, activeCategoryGameIds, games]
  );

  return (
    <div className="flex-grow flex flex-col h-screen overflow-hidden bg-bgDark select-none">
      {/* Header Banner */}
      <div className="p-8 border-b border-slate-800/60 bg-slate-950/20 flex-shrink-0 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-100 tracking-wide flex items-center space-x-3">
            <Award className="w-6 h-6 text-purple-400 animate-bounce" />
            <span>Gaming Analytics & Playtime Insights</span>
          </h2>
          <p className="text-xs text-textMuted mt-1">Track your habits, historical log entries, and categorize your collections</p>
        </div>
        <button
          onClick={loadStatsData}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl text-xs font-bold text-slate-200 transition-all active:scale-95 duration-100"
        >
          Refresh Stats
        </button>
      </div>

      {/* Main Body Grid */}
      <div className="flex-grow overflow-y-auto p-8 space-y-8 scrollbar-thin">
        
        {/* KPI Cards & SVG Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* KPI Dashboard */}
          <div className="space-y-4">
            <div className="bg-slate-900/30 border border-slate-800/50 rounded-2xl p-5 flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-400 shadow-inner">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-textMuted tracking-wider leading-none">Total Cumulative Playtime</span>
                <p className="text-2xl font-black text-slate-100 mt-1">{totalPlaytimeHours} <span className="text-xs text-textMuted font-bold">Hours</span></p>
              </div>
            </div>

            <div className="bg-slate-900/30 border border-slate-800/50 rounded-2xl p-5 flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 text-purple-400 shadow-inner">
                <Gamepad2 className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-textMuted tracking-wider leading-none">Games Active / Played</span>
                <p className="text-2xl font-black text-slate-100 mt-1">{playedGamesCount} <span className="text-xs text-textMuted font-bold">of {games.length} Games</span></p>
              </div>
            </div>

            <div className="bg-slate-900/30 border border-slate-800/50 rounded-2xl p-5 flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400 shadow-inner">
                <Flame className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-textMuted tracking-wider leading-none">Recent Play Sessions</span>
                <p className="text-2xl font-black text-slate-100 mt-1">{sessions.length} <span className="text-xs text-textMuted font-bold">Recorded Logs</span></p>
              </div>
            </div>
          </div>

          {/* Responsive SVG Playtime Weekly Bar Chart */}
          <div className="lg:col-span-2 bg-slate-900/20 border border-slate-800/40 rounded-2xl p-5 flex flex-col justify-between h-full min-h-[220px]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs uppercase font-extrabold text-slate-200 tracking-wider flex items-center space-x-2">
                <BarChart2 className="w-4 h-4 text-purple-400" />
                <span>Weekly Gaming Activity (Hours)</span>
              </h3>
              <span className="text-[10px] font-bold text-textMuted bg-slate-950/60 px-2 py-0.5 rounded-md">Last 7 Days</span>
            </div>
            
            <div className="flex-grow flex items-end justify-between px-4 pb-2 pt-6 h-36">
              {weeklyData.map((d, idx) => {
                const heightPercent = Math.min((d.hours / maxWeeklyHours) * 100, 100);
                return (
                  <div key={idx} className="flex flex-col items-center group relative w-1/8">
                    {/* Tooltip on Hover */}
                    <div className="absolute bottom-[calc(100%+8px)] scale-0 group-hover:scale-100 bg-slate-950 text-[10px] text-slate-200 px-2 py-1 rounded border border-slate-800 font-bold tracking-wide transition-all z-20 pointer-events-none select-none text-center shadow-lg">
                      {d.hours} hrs played
                    </div>
                    {/* Bar */}
                    <div 
                      className="w-8 rounded-t-lg bg-gradient-to-t from-blue-600 to-purple-600 group-hover:from-blue-500 group-hover:to-purple-500 transition-all duration-300 shadow-md group-hover:shadow-indigo-900/60 shadow-inner min-h-[4px]"
                      style={{ height: `${Math.max(heightPercent, 3)}%` }}
                    />
                    {/* Label */}
                    <span className="text-[10px] font-bold text-textMuted mt-2 group-hover:text-slate-200 transition-colors uppercase tracking-wider">{d.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Second Row: Favorite Genres & Historical Log */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Favorite Genres Card */}
          <div className="bg-slate-900/20 border border-slate-800/40 rounded-2xl p-6 space-y-5">
            <h3 className="text-xs uppercase font-extrabold text-slate-200 tracking-wider flex items-center space-x-2 border-b border-slate-800/60 pb-3">
              <span>Favorite Gaming Genres</span>
            </h3>
            
            {topGenres.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-center p-4">
                <HelpCircle className="w-10 h-10 text-slate-700 mb-2" />
                <p className="text-xs text-textMuted">No playtime recordings resolved yet. Launch some games to see your favorite genre split!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {topGenres.map((g, idx) => {
                  const percent = Math.round((g.rawSeconds / totalGenreSeconds) * 100);
                  const colors = [
                    "from-purple-500 to-indigo-500",
                    "from-blue-500 to-indigo-500",
                    "from-emerald-500 to-teal-500",
                    "from-rose-500 to-red-500",
                    "from-amber-500 to-orange-500"
                  ];
                  return (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-slate-300 font-bold">{g.genre}</span>
                        <span className="text-textMuted">{g.hours} Hrs ({percent}%)</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-850">
                        <div 
                          className={`h-full rounded-full bg-gradient-to-r ${colors[idx % colors.length]}`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Historical Play Logs */}
          <div className="bg-slate-900/20 border border-slate-800/40 rounded-2xl p-6 flex flex-col h-full min-h-[300px]">
            <h3 className="text-xs uppercase font-extrabold text-slate-200 tracking-wider flex items-center space-x-2 border-b border-slate-800/60 pb-3 flex-shrink-0">
              <span>Recent Gaming Sessions</span>
            </h3>
            
            <div className="flex-grow overflow-y-auto mt-4 pr-1 space-y-3 max-h-[260px] scrollbar-thin">
              {sessions.length === 0 ? (
                <div className="h-44 flex flex-col items-center justify-center text-center p-4">
                  <Clock className="w-8 h-8 text-slate-700 mb-2" />
                  <p className="text-xs text-textMuted">No play history logged. Launch a game and return here after you exit!</p>
                </div>
              ) : (
                sessions.map((session, idx) => (
                  <div key={idx} className="p-3 bg-slate-950/40 hover:bg-slate-950/70 border border-slate-900/60 hover:border-slate-800 rounded-xl flex items-center justify-between transition-all duration-150">
                    <div className="flex items-center space-x-3">
                      {session.cover_path ? (
                        <img 
                          src={session.cover_path.startsWith("http") ? session.cover_path : `http://localhost:1421/artwork/${session.game_id}/cover.jpg`}
                          alt={session.game_title}
                          className="w-9 h-12 rounded object-cover border border-slate-850 flex-shrink-0"
                          onError={(e) => { e.currentTarget.style.display = "none"; }}
                        />
                      ) : (
                        <div className="w-9 h-12 rounded bg-gradient-to-br from-indigo-900 to-slate-950 border border-slate-800 flex items-center justify-center flex-shrink-0">
                          <Gamepad2 className="w-4 h-4 text-indigo-400" />
                        </div>
                      )}
                      <div>
                        <h4 className="text-xs font-extrabold text-slate-200 leading-tight">{session.game_title}</h4>
                        <span className="text-[10px] text-textMuted flex items-center space-x-1 mt-0.5">
                          <Calendar className="w-3 h-3 text-slate-600" />
                          <span>{formatDate(session.played_at)}</span>
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-100 bg-slate-900/80 border border-slate-800/80 px-2.5 py-1 rounded-lg">
                        +{formatDuration(session.playtime_seconds)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Third Row: Category / Tag Management */}
        <div className="bg-slate-900/20 border border-slate-800/40 rounded-2xl p-6 space-y-6">
          <div className="border-b border-slate-800/60 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h3 className="text-xs uppercase font-extrabold text-slate-200 tracking-wider flex items-center space-x-2">
              <Tag className="w-4 h-4 text-purple-400" />
              <span>Custom Category Management</span>
            </h3>
            
            {/* Create Category Form */}
            <form onSubmit={handleCreateCategory} className="flex items-center space-x-2">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g. Backlog, Completed..."
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500 select-text"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-xs font-bold text-white shadow-md flex items-center space-x-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Tag</span>
              </button>
            </form>
          </div>

          {categories.length === 0 ? (
            <div className="h-32 flex flex-col items-center justify-center text-center p-4">
              <Tag className="w-8 h-8 text-slate-700 mb-2" />
              <p className="text-xs text-textMuted">No custom categories registered. Input a tag name above to create your first folder!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Category Selector Menu */}
              <div className="space-y-2 border-r border-slate-800/20 pr-4">
                <span className="text-[10px] uppercase font-bold text-textMuted tracking-wider">Select Category</span>
                <div className="space-y-1.5 max-h-[300px] overflow-y-auto scrollbar-thin mt-1.5">
                  {categories.map((cat) => (
                    <div 
                      key={cat.id}
                      onClick={() => setSelectedCategoryId(cat.id)}
                      className={`p-3 rounded-xl border flex items-center justify-between transition-all duration-150 cursor-pointer ${
                        selectedCategoryId === cat.id
                          ? "bg-gradient-to-r from-blue-600/20 to-purple-600/10 border-blue-500 text-white"
                          : "bg-slate-950/30 hover:bg-slate-950/60 border-slate-850 text-slate-400 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <Tag className="w-3.5 h-3.5 text-purple-400" />
                        <span className="text-xs font-bold">{cat.name}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-bold bg-slate-900 px-2 py-0.5 rounded text-slate-400">{cat.game_ids.length} games</span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.id); }}
                          className="text-slate-500 hover:text-rose-400 p-0.5 hover:bg-slate-900 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Category Bind Manager */}
              <div className="md:col-span-2 space-y-4">
                {activeCategory ? (
                  <>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-950/40 p-4 border border-slate-900 rounded-2xl">
                      <div>
                        <h4 className="text-xs font-extrabold text-slate-200">Manage Category: <span className="text-purple-400 font-black">{activeCategory.name}</span></h4>
                        <p className="text-[10px] text-textMuted mt-0.5">Link games from your library directly to this collection</p>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <select
                          value={selectedGameId}
                          onChange={(e) => setSelectedGameId(e.target.value)}
                          className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none max-w-[200px]"
                        >
                          <option value="">-- Select Game --</option>
                          {gamesAvailableForCategory.map((game) => (
                            <option key={game.id} value={game.id}>{game.title}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={handleAddGameToCategory}
                          disabled={!selectedGameId}
                          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-xs font-bold text-white rounded-xl shadow-lg shadow-purple-950/40 cursor-pointer disabled:cursor-not-allowed transition-all"
                        >
                          Add Game
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="text-[10px] uppercase font-bold text-textMuted tracking-wider">Games in this Tag ({gamesInCategory.length})</span>
                      {gamesInCategory.length === 0 ? (
                        <div className="p-6 text-center bg-slate-950/10 border border-slate-850 border-dashed rounded-2xl text-xs text-textMuted">
                          No games categorized under "{activeCategory.name}" yet. Select a game from the dropdown to start tag bindings!
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[220px] overflow-y-auto scrollbar-thin">
                          {gamesInCategory.map((game) => (
                            <div key={game.id} className="p-3 bg-slate-950/30 border border-slate-900 rounded-xl flex items-center justify-between hover:border-slate-800 transition-colors">
                              <span className="text-xs font-bold text-slate-300 truncate max-w-[180px]">{game.title}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveGameFromCategory(game.id, activeCategory.id)}
                                className="text-slate-500 hover:text-rose-400 text-xs font-bold px-2 py-1 rounded bg-slate-900/60 hover:bg-slate-900 transition-colors"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center text-center p-6 text-xs text-textMuted">
                    Select a category from the left menu to manage tag relations.
                  </div>
                )}
              </div>

            </div>
          )}
        </div>

      </div>
    </div>
  );
};
