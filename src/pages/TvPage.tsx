import React, { useState, useEffect, useRef } from "react";
import { Game } from "../types/game";
import { getArtworkUrl } from "../utils/artwork";
import { SourceBadge } from "../components/SourceBadge";
import { Play, Heart, LogOut, Gamepad, Info } from "lucide-react";

interface TvPageProps {
  games: Game[];
  onLaunch: (gameId: string) => void;
  onToggleFavorite: (gameId: string) => void;
  onExit: () => void;
}

export const TvPage: React.FC<TvPageProps> = ({
  games,
  onLaunch,
  onToggleFavorite,
  onExit,
}) => {
  const visibleGames = games.filter(g => !g.hidden);
  
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [activeCategory, setActiveCategory] = useState("all"); // all, favorites, steam, epic, manual
  const [gamepadConnected, setGamepadConnected] = useState(false);
  const [timeStr, setTimeStr] = useState("");

  const carouselRef = useRef<HTMLDivElement>(null);
  const buttonCooldown = useRef(false);

  // Group games based on selected category
  const getFilteredGames = () => {
    switch (activeCategory) {
      case "favorites":
        return visibleGames.filter(g => g.favorite);
      case "steam":
        return visibleGames.filter(g => g.source === "steam");
      case "epic":
        return visibleGames.filter(g => g.source === "epic");
      case "manual":
        return visibleGames.filter(g => g.source === "manual");
      default:
        return visibleGames;
    }
  };

  const filteredGames = getFilteredGames();
  const activeGame = filteredGames[focusedIndex] || null;

  // Real-time Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (filteredGames.length === 0) return;

      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          setFocusedIndex(prev => (prev + 1) % filteredGames.length);
          break;
        case "ArrowLeft":
          e.preventDefault();
          setFocusedIndex(prev => (prev - 1 + filteredGames.length) % filteredGames.length);
          break;
        case "ArrowDown":
          e.preventDefault();
          // Cycle through categories: all -> favorites -> steam -> epic -> manual
          const cats = ["all", "favorites", "steam", "epic", "manual"];
          const nextCatIdx = (cats.indexOf(activeCategory) + 1) % cats.length;
          setActiveCategory(cats[nextCatIdx]);
          setFocusedIndex(0);
          break;
        case "ArrowUp":
          e.preventDefault();
          const catsUp = ["all", "favorites", "steam", "epic", "manual"];
          const prevCatIdx = (catsUp.indexOf(activeCategory) - 1 + catsUp.length) % catsUp.length;
          setActiveCategory(catsUp[prevCatIdx]);
          setFocusedIndex(0);
          break;
        case "Enter":
          e.preventDefault();
          if (activeGame) {
            onLaunch(activeGame.id);
          }
          break;
        case "Escape":
          e.preventDefault();
          onExit();
          break;
        case "f":
        case "F":
          e.preventDefault();
          if (activeGame) {
            onToggleFavorite(activeGame.id);
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredGames, activeCategory, activeGame, onLaunch, onExit, onToggleFavorite]);

  // Gamepad Loop API
  useEffect(() => {
    let animationFrameId: number;

    const gamepadScan = () => {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      let gp = null;
      for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i]) {
          gp = gamepads[i];
          break;
        }
      }

      if (gp) {
        setGamepadConnected(true);

        // Cooldown mechanism to prevent rapid repeat inputs on hold
        if (!buttonCooldown.current) {
          // Left stick horizontal or D-Pad Left/Right
          const axisX = gp.axes[0];
          const dpadLeft = gp.buttons[14]?.pressed;
          const dpadRight = gp.buttons[15]?.pressed;

          // Left stick vertical or D-Pad Up/Down
          const axisY = gp.axes[1];
          const dpadUp = gp.buttons[12]?.pressed;
          const dpadDown = gp.buttons[13]?.pressed;

          // Button triggers
          const buttonA = gp.buttons[0]?.pressed; // A / Cross (Select/Launch)
          const buttonB = gp.buttons[1]?.pressed; // B / Circle (Exit/Back)
          const buttonX = gp.buttons[2]?.pressed; // X / Square (Favorite)

          let actionTriggered = false;

          if (filteredGames.length > 0) {
            if (axisX > 0.5 || dpadRight) {
              setFocusedIndex(prev => (prev + 1) % filteredGames.length);
              actionTriggered = true;
            } else if (axisX < -0.5 || dpadLeft) {
              setFocusedIndex(prev => (prev - 1 + filteredGames.length) % filteredGames.length);
              actionTriggered = true;
            } else if (axisY > 0.5 || dpadDown) {
              const cats = ["all", "favorites", "steam", "epic", "manual"];
              const nextCatIdx = (cats.indexOf(activeCategory) + 1) % cats.length;
              setActiveCategory(cats[nextCatIdx]);
              setFocusedIndex(0);
              actionTriggered = true;
            } else if (axisY < -0.5 || dpadUp) {
              const catsUp = ["all", "favorites", "steam", "epic", "manual"];
              const prevCatIdx = (catsUp.indexOf(activeCategory) - 1 + catsUp.length) % catsUp.length;
              setActiveCategory(catsUp[prevCatIdx]);
              setFocusedIndex(0);
              actionTriggered = true;
            } else if (buttonA) {
              if (activeGame) {
                onLaunch(activeGame.id);
              }
              actionTriggered = true;
            } else if (buttonX) {
              if (activeGame) {
                onToggleFavorite(activeGame.id);
              }
              actionTriggered = true;
            }
          }

          if (buttonB) {
            onExit();
            actionTriggered = true;
          }

          if (actionTriggered) {
            buttonCooldown.current = true;
            // Cooldown timeout of 220ms
            setTimeout(() => {
              buttonCooldown.current = false;
            }, 220);
          }
        }
      } else {
        setGamepadConnected(false);
      }

      animationFrameId = requestAnimationFrame(gamepadScan);
    };

    animationFrameId = requestAnimationFrame(gamepadScan);

    const handleConnect = () => setGamepadConnected(true);
    const handleDisconnect = () => setGamepadConnected(false);

    window.addEventListener("gamepadconnected", handleConnect);
    window.addEventListener("gamepaddisconnected", handleDisconnect);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("gamepadconnected", handleConnect);
      window.removeEventListener("gamepaddisconnected", handleDisconnect);
    };
  }, [filteredGames, activeCategory, activeGame, onLaunch, onExit, onToggleFavorite]);

  // Keep active game centered in the carousel scroll
  useEffect(() => {
    if (carouselRef.current) {
      const activeCard = carouselRef.current.children[focusedIndex] as HTMLElement;
      if (activeCard) {
        const containerWidth = carouselRef.current.offsetWidth;
        const cardOffset = activeCard.offsetLeft;
        const cardWidth = activeCard.offsetWidth;
        
        // Compute target scroll offset to center card
        const targetScroll = cardOffset - (containerWidth / 2) + (cardWidth / 2);
        carouselRef.current.scrollTo({
          left: targetScroll,
          behavior: "smooth"
        });
      }
    }
  }, [focusedIndex]);

  // Generate deterministic fallbacks
  const generateGradient = (title: string) => {
    const gradients = [
      "from-purple-900/60 to-indigo-950/90",
      "from-slate-900/60 to-blue-950/90",
      "from-emerald-950/60 to-teal-900/90",
      "from-rose-950/60 to-slate-950/90",
      "from-blue-950/60 to-violet-950/90",
    ];
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
      hash = title.charCodeAt(i) + ((hash << 5) - hash);
    }
    return gradients[Math.abs(hash) % gradients.length];
  };

  const getActiveGameGradient = () => {
    if (!activeGame) return "from-slate-900/80 to-slate-950/95";
    return generateGradient(activeGame.title);
  };

  return (
    <div className="w-screen h-screen bg-black overflow-hidden flex flex-col justify-between relative text-white select-none select-none font-sans">
      
      {/* Background Hero Banner Blur */}
      {activeGame?.artwork?.hero_path || activeGame?.artwork_path || activeGame?.artwork?.cover_path ? (
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-30 blur-2xl -z-10 transition-all duration-700 ease-in-out scale-105"
          style={{ backgroundImage: `url(${getArtworkUrl(activeGame.artwork?.hero_path || activeGame.artwork?.cover_path || activeGame.artwork_path)})` }}
        />
      ) : (
        <div className={`absolute inset-0 bg-gradient-to-b ${getActiveGameGradient()} opacity-40 blur-3xl -z-10 transition-all duration-700`} />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/80 to-black -z-10" />

      {/* 1. Header (Time / Gamepad Status / Categories) */}
      <header className="p-8 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent flex-shrink-0">
        {/* Collections filters */}
        <div className="flex items-center space-x-6">
          <span className="text-xl font-black bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent tracking-widest">
            LAUNCHY TV
          </span>
          <div className="flex items-center space-x-3 bg-slate-900/40 backdrop-blur-md border border-slate-800/40 p-1.5 rounded-2xl">
            {["all", "favorites", "steam", "epic", "manual"].map(cat => (
              <button
                key={cat}
                onClick={() => { setActiveCategory(cat); setFocusedIndex(0); }}
                className={`px-4 py-1.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all duration-150 ${
                  activeCategory === cat
                    ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-indigo-900/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {cat === "all" ? "All Games" : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Time and Gamepad indicators */}
        <div className="flex items-center space-x-5">
          <div className={`flex items-center space-x-1.5 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider transition-all duration-300 ${
            gamepadConnected
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              : "bg-slate-900/40 border-slate-800/60 text-slate-500"
          }`}>
            <Gamepad className="w-3.5 h-3.5" />
            <span>{gamepadConnected ? "Controller Active" : "No Gamepad"}</span>
          </div>
          <span className="text-xl font-bold font-mono tracking-wider text-slate-300 bg-slate-900/40 px-4 py-1.5 rounded-2xl border border-slate-800/30">
            {timeStr}
          </span>
        </div>
      </header>

      {/* 2. Spotlight Spotlight Display (Middle Section) */}
      <main className="flex-grow flex items-center px-12 md:px-20 select-none overflow-hidden max-h-[50vh]">
        {activeGame ? (
          <div className="w-full flex space-x-8 md:space-x-12 items-center animate-in fade-in slide-in-from-bottom-4 duration-300">
            
            {/* Highlighted Cover image */}
            <div className="w-48 aspect-[3/4] rounded-2xl overflow-hidden border border-slate-700 shadow-2xl flex-shrink-0 transform scale-100 hover:scale-102 transition-all">
              {activeGame.artwork?.cover_path || activeGame.artwork_path ? (
                <img 
                  src={getArtworkUrl(activeGame.artwork?.cover_path || activeGame.artwork_path)}
                  alt={activeGame.title}
                  className="w-full h-full object-cover"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              ) : (
                <div className={`w-full h-full bg-gradient-to-br ${generateGradient(activeGame.title)} flex items-center justify-center p-4 text-center`}>
                  <span className="text-sm font-black text-white/80 tracking-wider leading-tight">{activeGame.title}</span>
                </div>
              )}
            </div>

            {/* Widescreen Spotlight details */}
            <div className="space-y-4 max-w-2xl">
              <div className="flex items-center space-x-3">
                <SourceBadge source={activeGame.source} size="md" />
                {activeGame.developer && (
                  <span className="text-[10px] font-bold text-purple-400 bg-purple-950/40 border border-purple-900/30 px-2 py-0.5 rounded-md uppercase tracking-wider">
                    {activeGame.developer}
                  </span>
                )}
              </div>
              <h2 className="text-4xl md:text-5xl font-black text-slate-100 tracking-wide line-clamp-1 drop-shadow-md">
                {activeGame.title}
              </h2>
              {activeGame.description ? (
                <p className="text-sm text-slate-300/90 leading-relaxed line-clamp-3 select-text pr-4 max-w-xl">
                  {activeGame.description}
                </p>
              ) : (
                <p className="text-sm text-textMuted italic max-w-xl">
                  No description loaded. Synchronize game information inside the Settings panel to populate summary details.
                </p>
              )}
              
              <div className="flex space-x-4 pt-2">
                <button
                  onClick={() => onLaunch(activeGame.id)}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl font-extrabold text-sm shadow-xl shadow-indigo-900/40 hover:shadow-indigo-800/50 flex items-center space-x-2 transition-all active:scale-95 duration-100 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>PLAY NOW</span>
                </button>
                <button
                  onClick={() => onToggleFavorite(activeGame.id)}
                  className={`px-4 py-3 rounded-xl border font-bold text-sm transition-all flex items-center space-x-2 cursor-pointer ${
                    activeGame.favorite
                      ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                      : "bg-slate-900/60 border-slate-800 text-slate-300 hover:text-white"
                  }`}
                >
                  <Heart className={`w-4 h-4 ${activeGame.favorite ? "fill-current" : ""}`} />
                  <span>{activeGame.favorite ? "FAVORITED" : "FAVORITE"}</span>
                </button>
              </div>
            </div>

          </div>
        ) : (
          <div className="w-full text-center py-20">
            <Info className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-400">No games found in this collection</h3>
            <p className="text-xs text-textMuted mt-1">Navigate to other categories or scan library folders in System Settings.</p>
          </div>
        )}
      </main>

      {/* 3. Horizontal Scrollable Carousel (Bottom Section) */}
      <footer className="w-full bg-gradient-to-t from-black via-black/90 to-transparent pt-4 pb-8 flex-shrink-0">
        <div 
          ref={carouselRef}
          className="flex space-x-6 overflow-x-hidden px-[40vw] pb-4 pt-2 scrollbar-none items-end h-48 select-none"
        >
          {filteredGames.map((game, idx) => {
            const isFocused = idx === focusedIndex;
            return (
              <div 
                key={game.id}
                onClick={() => setFocusedIndex(idx)}
                className={`w-28 aspect-[3/4] rounded-xl overflow-hidden border transition-all duration-300 cursor-pointer flex-shrink-0 relative ${
                  isFocused 
                    ? "scale-115 border-purple-500 shadow-2xl shadow-purple-950/60 z-10 -translate-y-2 ring-2 ring-purple-500/30" 
                    : "scale-90 border-slate-800 hover:border-slate-700 opacity-60 hover:opacity-90"
                }`}
              >
                {game.artwork?.cover_path || game.artwork_path ? (
                  <img 
                    src={getArtworkUrl(game.artwork?.cover_path || game.artwork_path)}
                    alt={game.title}
                    className="w-full h-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${generateGradient(game.title)} flex items-center justify-center p-2 text-center`}>
                    <span className="text-[10px] font-black text-white/80 leading-tight">{game.title}</span>
                  </div>
                )}
                {/* Active Focus Overlay Badge */}
                {isFocused && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent py-1 text-center">
                    <span className="text-[8px] font-black uppercase text-purple-400 tracking-wider">Focused</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 4. Help Bar & Shortcuts */}
        <div className="flex items-center justify-between px-12 border-t border-slate-900/60 pt-4 text-xs font-bold text-textMuted select-none">
          <div className="flex items-center space-x-6">
            <span className="flex items-center space-x-1.5">
              <span className="bg-slate-900 border border-slate-800 text-slate-300 px-1.5 py-0.5 rounded text-[10px] font-mono">◀ / ▶</span>
              <span>Navigate</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <span className="bg-slate-900 border border-slate-800 text-slate-300 px-1.5 py-0.5 rounded text-[10px] font-mono">Enter</span>
              <span>Launch Game</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <span className="bg-slate-900 border border-slate-800 text-slate-300 px-1.5 py-0.5 rounded text-[10px] font-mono">F</span>
              <span>Toggle Favorite</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <span className="bg-slate-900 border border-slate-800 text-slate-300 px-1.5 py-0.5 rounded text-[10px] font-mono">ESC</span>
              <span>Exit TV Mode</span>
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button 
              onClick={onExit} 
              title="Exit TV Mode" 
              className="text-slate-500 hover:text-white transition-colors cursor-pointer p-1 rounded-lg hover:bg-slate-900/60"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </footer>

    </div>
  );
};
