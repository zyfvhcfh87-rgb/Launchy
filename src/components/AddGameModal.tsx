import React, { useState } from "react";
import { X, Plus, Gamepad2 } from "lucide-react";

interface AddGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddGame: (gameData: {
    title: string;
    exePath: string;
    args: string;
    artworkPath: string;
    runnerType?: string;
    runnerPath?: string;
    runnerPrefix?: string;
  }) => void;
}

export const AddGameModal: React.FC<AddGameModalProps> = ({
  isOpen,
  onClose,
  onAddGame,
}) => {
  const [title, setTitle] = useState("");
  const [exePath, setExePath] = useState("");
  const [args, setArgs] = useState("");
  const [artworkPath, setArtworkPath] = useState("");
  const [runnerType, setRunnerType] = useState("native"); // native, wine, proton
  const [runnerPath, setRunnerPath] = useState("");
  const [runnerPrefix, setRunnerPrefix] = useState("");
  const [error, setError] = useState("");

  const handleBrowseExe = async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const selected = await invoke<string | null>("select_file", {
        title: "Select Game Executable",
        filterName: "Executables",
        extensions: ["exe", "bat", "lnk", "cmd", "sh", "bin"]
      });
      if (selected) {
        setExePath(selected);
        // Clean and format display title from executable
        const separator = selected.includes("/") ? "/" : "\\";
        const filename = selected.substring(selected.lastIndexOf(separator) + 1);
        const lastDot = filename.lastIndexOf(".");
        const nameWithoutExt = lastDot !== -1 ? filename.substring(0, lastDot) : filename;
        const cleanName = nameWithoutExt.split(/[_\-\s]+/)
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
        setTitle(prev => prev ? prev : cleanName);
      }
    } catch (err) {
      console.error("Failed to browse executable:", err);
    }
  };

  const handleBrowseArtwork = async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const selected = await invoke<string | null>("select_file", {
        title: "Select Game Cover Image",
        filterName: "Images",
        extensions: ["png", "jpg", "jpeg", "webp", "gif"]
      });
      if (selected) {
        setArtworkPath(selected);
      }
    } catch (err) {
      console.error("Failed to browse artwork:", err);
    }
  };

  const handleBrowseRunner = async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const selected = await invoke<string | null>("select_file", {
        title: "Select Wine/Proton Runner Executable",
        filterName: "Executables",
        extensions: []
      });
      if (selected) {
        setRunnerPath(selected);
      }
    } catch (err) {
      console.error("Failed to browse runner:", err);
    }
  };

  const handleBrowsePrefix = async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const selected = await invoke<string | null>("select_directory", {
        title: "Select Wine Prefix Directory"
      });
      if (selected) {
        setRunnerPrefix(selected);
      }
    } catch (err) {
      console.error("Failed to browse prefix:", err);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Game title is required.");
      return;
    }
    if (!exePath.trim()) {
      setError("Executable path is required.");
      return;
    }
    
    setError("");
    onAddGame({ 
      title, 
      exePath, 
      args, 
      artworkPath,
      runnerType: runnerType !== "native" ? runnerType : undefined,
      runnerPath: runnerType !== "native" ? runnerPath || undefined : undefined,
      runnerPrefix: runnerType !== "native" ? runnerPrefix || undefined : undefined
    });
    
    // Reset form
    setTitle("");
    setExePath("");
    setArgs("");
    setArtworkPath("");
    setRunnerType("native");
    setRunnerPath("");
    setRunnerPrefix("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-lg bg-bgCard border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
              <Gamepad2 className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Add Custom Game Entry</h2>
              <p className="text-xs text-textMuted">Register standalone or emulated games</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all duration-150"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-grow scrollbar-thin">
          {error && (
            <div className="p-3 text-xs bg-red-950/40 border border-red-900/30 rounded-lg text-red-400 font-semibold select-none">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs uppercase font-bold text-textMuted mb-1.5 tracking-wider">
              Game Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Minecraft, Hollow Knight"
              className="w-full px-4 py-2.5 bg-slate-900/60 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 text-sm select-text"
              required
            />
          </div>

          <div>
            <label className="block text-xs uppercase font-bold text-textMuted mb-1.5 tracking-wider">
              Executable Path <span className="text-red-500">*</span>
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={exePath}
                onChange={(e) => setExePath(e.target.value)}
                placeholder="e.g. C:\Games\GameName\game.exe"
                className="flex-grow px-4 py-2.5 bg-slate-900/60 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 text-sm select-text"
                required
              />
              <button
                type="button"
                onClick={handleBrowseExe}
                className="px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-850 rounded-xl text-xs font-semibold transition-all active:scale-95 duration-100 flex-shrink-0"
              >
                Browse...
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase font-bold text-textMuted mb-1.5 tracking-wider">
              Launch Arguments <span className="text-textMuted/60">(Optional)</span>
            </label>
            <input
              type="text"
              value={args}
              onChange={(e) => setArgs(e.target.value)}
              placeholder="e.g. --windowed --no-intro"
              className="w-full px-4 py-2.5 bg-slate-900/60 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 text-sm select-text"
            />
          </div>

          <div>
            <label className="block text-xs uppercase font-bold text-textMuted mb-1.5 tracking-wider">
              Cover Artwork Path / URL <span className="text-textMuted/60">(Optional)</span>
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={artworkPath}
                onChange={(e) => setArtworkPath(e.target.value)}
                placeholder="e.g. C:\Artwork\cover.jpg or https://image-url..."
                className="flex-grow px-4 py-2.5 bg-slate-900/60 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 text-sm select-text"
              />
              <button
                type="button"
                onClick={handleBrowseArtwork}
                className="px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-850 rounded-xl text-xs font-semibold transition-all active:scale-95 duration-100 flex-shrink-0"
              >
                Browse...
              </button>
            </div>
          </div>

          {/* Runner Customization Section */}
          <div className="border-t border-slate-800/60 pt-4 space-y-4">
            <h3 className="text-xs uppercase font-bold text-slate-200 tracking-wider">Compatibility Runner</h3>
            
            <div>
              <label className="block text-xs uppercase font-bold text-textMuted mb-1.5 tracking-wider">Runner Type</label>
              <select
                value={runnerType}
                onChange={(e) => setRunnerType(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-900/60 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-blue-500"
              >
                <option value="native">Native Execution</option>
                <option value="wine">Wine Runner</option>
                <option value="proton">Proton Runner</option>
              </select>
            </div>

            {runnerType !== "native" && (
              <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
                <div>
                  <label className="block text-xs uppercase font-bold text-textMuted mb-1.5 tracking-wider">
                    Runner Binary Path <span className="text-textMuted/60">(Optional - defaults to system 'wine')</span>
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={runnerPath}
                      onChange={(e) => setRunnerPath(e.target.value)}
                      placeholder="/usr/bin/wine or path/to/proton"
                      className="flex-grow px-4 py-2.5 bg-slate-900/60 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 text-sm select-text"
                    />
                    <button
                      type="button"
                      onClick={handleBrowseRunner}
                      className="px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-850 rounded-xl text-xs font-semibold transition-all active:scale-95 duration-100 flex-shrink-0"
                    >
                      Browse...
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs uppercase font-bold text-textMuted mb-1.5 tracking-wider">
                    Wine Prefix Path <span className="text-textMuted/60">(Optional - defaults to ~/.wine)</span>
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={runnerPrefix}
                      onChange={(e) => setRunnerPrefix(e.target.value)}
                      placeholder="/home/user/.wine"
                      className="flex-grow px-4 py-2.5 bg-slate-900/60 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 text-sm select-text"
                    />
                    <button
                      type="button"
                      onClick={handleBrowsePrefix}
                      className="px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-850 rounded-xl text-xs font-semibold transition-all active:scale-95 duration-100 flex-shrink-0"
                    >
                      Browse...
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-800/40 flex justify-end space-x-3 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-transparent text-slate-400 hover:text-white text-sm font-semibold rounded-lg transition-colors select-none"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-indigo-900/40 transition-all select-none flex items-center space-x-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>ADD GAME</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
