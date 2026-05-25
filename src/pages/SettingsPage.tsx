import React, { useState } from "react";
import { LibrarySource } from "../types/game";
import { RefreshCw, FolderSearch, ShieldCheck, Gamepad2, HelpCircle, HardDrive, Trash2, Plus, FolderPlus } from "lucide-react";

interface SettingsPageProps {
  sources: LibrarySource[];
  isScanning: boolean;
  onScanLibraries: () => void;
  onOpenAddModal: () => void;
  onAddSource: (source: "steam" | "epic", path: string) => void;
  onRemoveSource: (id: string) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  sources,
  isScanning,
  onScanLibraries,
  onOpenAddModal,
  onAddSource,
  onRemoveSource,
}) => {
  const [newSourceType, setNewSourceType] = useState<"steam" | "epic">("steam");
  const [newSourcePath, setNewSourcePath] = useState("");
  const [formError, setFormError] = useState("");

  const handleBrowseFolder = async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const selected = await invoke<string | null>("select_directory", {
        title: newSourceType === "steam" ? "Select Steam Library Folder" : "Select Epic Games Manifest Directory"
      });
      if (selected) {
        setNewSourcePath(selected);
      }
    } catch (err) {
      console.error("Failed to browse directory:", err);
    }
  };

  const handleAddSourceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourcePath.trim()) {
      setFormError("Folder path cannot be empty.");
      return;
    }
    setFormError("");
    onAddSource(newSourceType, newSourcePath.trim());
    setNewSourcePath(""); // Reset path
  };

  return (
    <div className="flex-grow p-8 overflow-y-auto select-none animate-in fade-in duration-300">
      
      {/* Title */}
      <div className="flex justify-between items-start border-b border-slate-800/40 pb-6 mb-8">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-100 tracking-wide">
            SYSTEM SETTINGS
          </h2>
          <p className="text-sm text-textMuted mt-1">
            Manage library folders, scanner directories, and third-party platform mappings
          </p>
        </div>
        <button
          onClick={onScanLibraries}
          disabled={isScanning}
          className={`px-5 py-2.5 rounded-xl font-bold text-xs tracking-wider transition-all duration-300 transform active:scale-95 flex items-center space-x-2 border shadow-lg ${
            isScanning
              ? "bg-slate-900/60 text-slate-500 border-slate-800 cursor-wait"
              : "bg-blue-600 hover:bg-blue-500 text-white border-blue-500/20 shadow-blue-900/20"
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${isScanning ? "animate-spin" : ""}`} />
          <span>{isScanning ? "SCANNING LIBRARIES..." : "SCAN LIBRARIES NOW"}</span>
        </button>
      </div>
 
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Main Column */}
        <div className="xl:col-span-2 space-y-8">
          
          {/* Auto-Detected Platforms Box */}
          <div className="bg-bgCard border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-5 border-b border-slate-800/60 bg-slate-950/40 flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <FolderSearch className="w-5 h-5 text-blue-400" />
                <h3 className="text-sm font-bold text-slate-200">Default Auto-Detected Platforms</h3>
              </div>
              <span className="text-[10px] font-bold text-textMuted bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                ACTIVE
              </span>
            </div>
 
            <div className="p-5 divide-y divide-slate-800/40">
              
              {/* Steam Row */}
              <div className="py-4 first:pt-0 last:pb-0 flex items-start justify-between">
                <div className="space-y-1.5 max-w-[80%]">
                  <div className="flex items-center space-x-2.5">
                    <svg className="w-4 h-4 text-sky-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 .007c-6.19 0-11.28 4.757-11.91 10.838l6.39 2.64c.54-.37 1.19-.59 1.9-.59h.06l2.87-4.14V8.69a3.78 3.78 0 1 1 3.78 3.78h-.06l-4.14 2.87v.06c0 .87-.3 1.66-.82 2.3l2.64 6.39c6.08-.63 10.84-5.72 10.84-11.91C23.28 5.378 18.19.007 12 .007zm-3.6 13.91a1.2 1.2 0 1 1-1.2-1.2 1.2 1.2 0 0 1 1.2 1.2zm6.72-5.7a1.68 1.68 0 1 1-1.68 1.68 1.68 1.68 0 0 1 1.68-1.68z" />
                    </svg>
                    <span className="font-bold text-sm text-slate-200">Steam Integration</span>
                  </div>
                  <p className="text-xs text-textMuted">
                    Scans Registry path or default program folders on drive C:, parses library configurations `libraryfolders.vdf`, and imports manifest records.
                  </p>
                  <div className="text-[10px] text-slate-500 font-mono select-text bg-slate-950/40 p-2 rounded-lg border border-slate-900/60 inline-block w-full">
                    C:\Program Files (x86)\Steam\steamapps
                  </div>
                </div>
                <span className="text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-900/30 px-2 py-0.5 rounded font-bold uppercase tracking-wider select-none">
                  Online
                </span>
              </div>
 
              {/* Epic Row */}
              <div className="py-4 first:pt-0 last:pb-0 flex items-start justify-between">
                <div className="space-y-1.5 max-w-[80%]">
                  <div className="flex items-center space-x-2.5">
                    <svg className="w-4 h-4 text-neutral-100" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0L1.5 3.9v12.2L12 24l10.5-7.9V3.9L12 0zm7.8 15.6l-7.8 5.9-7.8-5.9V4.9l7.8-2.9 7.8 2.9v10.7zm-7.8-11.8c-2.3 0-4.1 1.8-4.1 4.1s1.8 4.1 4.1 4.1 4.1-1.8 4.1-4.1-1.8-4.1-4.1-4.1z" />
                    </svg>
                    <span className="font-bold text-sm text-slate-200">Epic Games Integration</span>
                  </div>
                  <p className="text-xs text-textMuted">
                    Retrieves `.item` catalog files inside system ProgramData folders. Launches natively or routes through Epic Games Launcher dynamically.
                  </p>
                  <div className="text-[10px] text-slate-500 font-mono select-text bg-slate-950/40 p-2 rounded-lg border border-slate-900/60 inline-block w-full">
                    C:\ProgramData\Epic\EpicGamesLauncher\Data\Manifests
                  </div>
                </div>
                <span className="text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-900/30 px-2 py-0.5 rounded font-bold uppercase tracking-wider select-none">
                  Online
                </span>
              </div>
 
              {/* Manual Row */}
              <div className="py-4 first:pt-0 last:pb-0 flex items-start justify-between">
                <div className="space-y-1.5 max-w-[80%]">
                  <div className="flex items-center space-x-2.5">
                    <Gamepad2 className="w-4 h-4 text-amber-500" />
                    <span className="font-bold text-sm text-slate-200">Manual Standalone Games</span>
                  </div>
                  <p className="text-xs text-textMuted">
                    Allows custom launcher files or independent binary registrations to let you track and play emulators, standalone tools, and GOG/itch titles.
                  </p>
                </div>
                <button
                  onClick={onOpenAddModal}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700/60 text-xs font-bold rounded-lg transition-all"
                >
                  ADD GAME
                </button>
              </div>
 
            </div>
          </div>
 
          {/* Custom Scan Directories Box */}
          <div className="bg-bgCard border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-5 border-b border-slate-800/60 bg-slate-950/40 flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <FolderPlus className="w-5 h-5 text-blue-400" />
                <h3 className="text-sm font-bold text-slate-200">Custom Library Folders</h3>
              </div>
              <span className="text-[10px] font-bold text-textMuted bg-slate-900 px-2 py-0.5 rounded border border-slate-800 uppercase">
                Manual Registry
              </span>
            </div>
 
            <div className="p-5 space-y-5">
              {/* Form to add new */}
              <form onSubmit={handleAddSourceSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-end bg-slate-950/40 border border-slate-900 p-4 rounded-xl">
                <div className="sm:col-span-3">
                  <label className="block text-[10px] uppercase font-bold text-textMuted mb-1.5 tracking-wider">Platform</label>
                  <select
                    value={newSourceType}
                    onChange={(e) => {
                      setNewSourceType(e.target.value as "steam" | "epic");
                      setFormError("");
                    }}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs font-semibold focus:outline-none focus:border-blue-500 text-white"
                  >
                    <option value="steam">Steam Library</option>
                    <option value="epic">Epic Manifests</option>
                  </select>
                </div>
                <div className="sm:col-span-7">
                  <label className="block text-[10px] uppercase font-bold text-textMuted mb-1.5 tracking-wider">Folder Directory Path</label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={newSourcePath}
                      onChange={(e) => setNewSourcePath(e.target.value)}
                      placeholder={newSourceType === "steam" ? "e.g. D:\\SteamLibrary (must contain steamapps)" : "e.g. D:\\EpicGames\\Manifests (folder with .item files)"}
                      className="flex-grow px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs focus:outline-none focus:border-blue-500 placeholder-slate-600 text-white select-text"
                      required
                    />
                    <button
                      type="button"
                      onClick={handleBrowseFolder}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-850 rounded-lg text-xs font-semibold transition-all active:scale-95 duration-100 flex-shrink-0"
                    >
                      Browse...
                    </button>
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg shadow transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>ADD</span>
                  </button>
                </div>
              </form>

              {formError && (
                <div className="p-3 text-xs bg-red-950/40 border border-red-900/30 rounded-lg text-red-400 font-semibold select-none">
                  {formError}
                </div>
              )}

              {/* List of custom sources */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-textMuted/60 tracking-wider">Registered Custom Directories</span>
                {sources.length === 0 ? (
                  <p className="text-xs text-textMuted/50 italic py-6 text-center bg-slate-900/10 border border-slate-800/30 rounded-xl select-none">
                    No custom scan folders registered. Add secondary drives or custom installer paths above.
                  </p>
                ) : (
                  <div className="space-y-2 overflow-y-auto max-h-60">
                    {sources.map((src) => (
                      <div key={src.id} className="flex items-center justify-between p-3.5 bg-slate-900/30 border border-slate-800/50 rounded-xl hover:bg-slate-900/50 transition-all">
                        <div className="space-y-1 truncate pr-4">
                          <div className="flex items-center space-x-2.5">
                            <span className={`text-[9px] uppercase font-black px-1.5 py-0.5 rounded select-none ${
                              src.source === "steam"
                                ? "bg-sky-950/40 border border-sky-900/30 text-sky-400"
                                : "bg-neutral-800 border border-neutral-700 text-neutral-200"
                            }`}>
                              {src.source}
                            </span>
                            <span className="text-xs font-semibold text-slate-300 truncate select-text">
                              {src.detected_path}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => onRemoveSource(src.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-800/50 transition-all cursor-pointer flex-shrink-0"
                          title="Remove custom source"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Privacy Standards Box */}
          <div className="bg-bgCard border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center space-x-3 text-slate-200">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h3 className="text-sm font-bold">Privacy & Reliability Standards</h3>
            </div>
            <p className="text-xs text-textMuted leading-relaxed">
              Launchy operates as a lightweight local shell. It is fully sandboxed and does not scrape authentication logs, bypass digital rights management (DRM), interfere with anti-cheat engines, or query process memory. Game authorization rests entirely with Steam and the Epic Games clients.
            </p>
            <div className="grid grid-cols-3 gap-4 border-t border-slate-800/30 pt-4 text-center">
              <div className="bg-slate-950/40 border border-slate-900 p-3 rounded-xl">
                <p className="text-[10px] text-textMuted font-bold uppercase tracking-wider">Local Only</p>
                <p className="text-xs font-bold text-slate-300 mt-1">100% Client-Side</p>
              </div>
              <div className="bg-slate-950/40 border border-slate-900 p-3 rounded-xl">
                <p className="text-[10px] text-textMuted font-bold uppercase tracking-wider">Authentication</p>
                <p className="text-xs font-bold text-slate-300 mt-1">No Login Required</p>
              </div>
              <div className="bg-slate-950/40 border border-slate-900 p-3 rounded-xl">
                <p className="text-[10px] text-textMuted font-bold uppercase tracking-wider">Anti-Cheat</p>
                <p className="text-xs font-bold text-slate-300 mt-1">Safe Process Check</p>
              </div>
            </div>
          </div>

        </div>

        {/* Sidebar Settings Column */}
        <div className="space-y-6">
          
          {/* Quick Statistics */}
          <div className="bg-bgCard border border-slate-800/80 rounded-2xl p-5 shadow-xl">
            <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center space-x-2">
              <HardDrive className="w-4.5 h-4.5 text-purple-400" />
              <span>Storage & Diagnostics</span>
            </h3>
            <div className="space-y-4">
              <div>
                <span className="text-[10px] text-textMuted font-bold uppercase tracking-wider block">Database File</span>
                <p className="text-[11px] font-mono text-slate-400 bg-slate-950/60 border border-slate-900/60 p-2 rounded-lg break-all mt-1 select-text">
                  %APPDATA%\Launchy\launchy.db
                </p>
              </div>
              <div>
                <span className="text-[10px] text-textMuted font-bold uppercase tracking-wider block">Diagnostics Version</span>
                <p className="text-xs text-slate-300 font-semibold mt-1">v0.1.0-alpha (Tauri Core)</p>
              </div>
              <div>
                <span className="text-[10px] text-textMuted font-bold uppercase tracking-wider block">App Host Shell</span>
                <p className="text-xs text-slate-300 font-semibold mt-1">Rust Backend | React + Vite UI</p>
              </div>
            </div>
          </div>

          {/* Troubleshooting Help */}
          <div className="bg-bgCard border border-slate-800/80 rounded-2xl p-5 shadow-xl">
            <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center space-x-2">
              <HelpCircle className="w-4.5 h-4.5 text-blue-400" />
              <span>Scanner Help</span>
            </h3>
            <div className="space-y-3.5 text-xs text-textMuted leading-relaxed">
              <p>
                <strong>Steam games missing?</strong> Ensure you have started the official Steam client at least once on this PC so that it registers the installation paths.
              </p>
              <p>
                <strong>Epic games missing?</strong> Epic Games manifests are retrieved from <code>C:\ProgramData</code>. Make sure the launcher has read access, or trigger a manual scan.
              </p>
              <p>
                <strong>Direct launch failing?</strong> Standalone manual games require you to select the primary executable (.exe) and not utility uninstallers or launcher logs.
              </p>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
