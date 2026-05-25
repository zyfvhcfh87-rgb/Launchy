import React from "react";
import { GameStatus } from "../types/game";
import { Play, Loader2, RefreshCw, AlertTriangle, ExternalLink } from "lucide-react";

interface StatusButtonProps {
  status: GameStatus;
  onClick: (e: React.MouseEvent) => void;
  fullWidth?: boolean;
  size?: "sm" | "md" | "lg";
}

export const StatusButton: React.FC<StatusButtonProps> = ({
  status,
  onClick,
  fullWidth = false,
  size = "md"
}) => {
  const getButtonConfig = () => {
    switch (status) {
      case "running":
        return {
          bg: "bg-emerald-600 hover:bg-emerald-500 text-white shadow-glow-green border border-emerald-500/30",
          text: "Running",
          icon: <Loader2 className="w-4 h-4 animate-spin mr-2" />,
          disabled: false,
        };
      case "launching":
        return {
          bg: "bg-blue-600/90 text-white animate-pulse border border-blue-500/30 cursor-wait",
          text: "Launching...",
          icon: <Loader2 className="w-4 h-4 animate-spin mr-2" />,
          disabled: true,
        };
      case "missing":
        return {
          bg: "bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-500/20",
          text: "Install Folder Missing",
          icon: <AlertTriangle className="w-4 h-4 mr-2" />,
          disabled: false,
        };
      case "needs_client":
        return {
          bg: "bg-indigo-600 hover:bg-indigo-500 text-white shadow-glow border border-indigo-500/30",
          text: "Open Client First",
          icon: <ExternalLink className="w-4 h-4 mr-2" />,
          disabled: false,
        };
      case "error":
        return {
          bg: "bg-red-600/30 hover:bg-red-600/40 text-red-300 border border-red-500/20",
          text: "Launch Failed - Retry",
          icon: <RefreshCw className="w-4 h-4 mr-2" />,
          disabled: false,
        };
      case "installed":
      default:
        return {
          bg: "bg-blue-600 hover:bg-blue-500 text-white shadow-glow border border-blue-500/30",
          text: "Play",
          icon: <Play className="w-4 h-4 mr-2 fill-current" />,
          disabled: false,
        };
    }
  };

  const { bg, text, icon, disabled } = getButtonConfig();

  const sizeClasses = {
    sm: "px-3 py-1 text-xs font-semibold rounded-md",
    md: "px-4 py-2 text-sm font-semibold rounded-lg",
    lg: "px-6 py-3 text-base font-bold rounded-xl",
  };

  return (
    <button
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onClick(e);
      }}
      className={`inline-flex items-center justify-center transition-all duration-300 transform active:scale-95 active:duration-75 tracking-wider select-none ${
        sizeClasses[size]
      } ${bg} ${fullWidth ? "w-full" : ""}`}
    >
      {icon}
      <span>{text.toUpperCase()}</span>
    </button>
  );
};
