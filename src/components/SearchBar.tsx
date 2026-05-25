import React from "react";
import { Search, X } from "lucide-react";

interface SearchBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  searchQuery,
  setSearchQuery,
}) => {
  return (
    <div className="relative flex-grow max-w-md select-none">
      <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-textMuted">
        <Search className="w-4 h-4" />
      </div>
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search library..."
        className="w-full pl-10 pr-10 py-2 rounded-xl bg-slate-900/60 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/30 text-sm tracking-wide transition-all duration-300"
      />
      {searchQuery && (
        <button
          onClick={() => setSearchQuery("")}
          className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-white transition-colors duration-150"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
