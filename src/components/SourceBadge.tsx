import React from "react";

interface SourceBadgeProps {
  source: "steam" | "epic" | "gog" | "uplay" | "ea" | "itch" | "manual";
  size?: "sm" | "md";
}

export const SourceBadge: React.FC<SourceBadgeProps> = ({ source, size = "sm" }) => {
  const isSm = size === "sm";

  const getSourceStyles = () => {
    switch (source) {
      case "steam":
        return {
          bg: "bg-slate-900/80 border border-slate-700/50 text-sky-400",
          label: "Steam",
          icon: (
            <svg className={`${isSm ? "w-3 h-3" : "w-4 h-4"} mr-1.5`} viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 .007c-6.19 0-11.28 4.757-11.91 10.838l6.39 2.64c.54-.37 1.19-.59 1.9-.59h.06l2.87-4.14V8.69a3.78 3.78 0 1 1 3.78 3.78h-.06l-4.14 2.87v.06c0 .87-.3 1.66-.82 2.3l2.64 6.39c6.08-.63 10.84-5.72 10.84-11.91C23.28 5.378 18.19.007 12 .007zm-3.6 13.91a1.2 1.2 0 1 1-1.2-1.2 1.2 1.2 0 0 1 1.2 1.2zm6.72-5.7a1.68 1.68 0 1 1-1.68 1.68 1.68 1.68 0 0 1 1.68-1.68z" />
            </svg>
          )
        };
      case "epic":
        return {
          bg: "bg-zinc-900/80 border border-zinc-700/50 text-neutral-100",
          label: "Epic Games",
          icon: (
            <svg className={`${isSm ? "w-3 h-3" : "w-4 h-4"} mr-1.5`} viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0L1.5 3.9v12.2L12 24l10.5-7.9V3.9L12 0zm7.8 15.6l-7.8 5.9-7.8-5.9V4.9l7.8-2.9 7.8 2.9v10.7zm-7.8-11.8c-2.3 0-4.1 1.8-4.1 4.1s1.8 4.1 4.1 4.1 4.1-1.8 4.1-4.1-1.8-4.1-4.1-4.1z" />
            </svg>
          )
        };
      case "gog":
        return {
          bg: "bg-purple-950/60 border border-purple-800/40 text-purple-400",
          label: "GOG Galaxy",
          icon: (
            <svg className={`${isSm ? "w-3 h-3" : "w-4 h-4"} mr-1.5`} viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm-1.8 4.8h3.6v1.8h-1.8v1.8h1.8v1.8h-3.6V4.8zm0 5.4h3.6v1.8h-1.8v1.8h1.8v1.8h-3.6v-5.4zm0 5.4h3.6v1.8h-1.8v1.8h1.8v1.8h-3.6v-5.4z" />
            </svg>
          )
        };
      case "uplay":
        return {
          bg: "bg-cyan-950/60 border border-cyan-800/40 text-cyan-400",
          label: "Ubisoft Connect",
          icon: (
            <svg className={`${isSm ? "w-3 h-3" : "w-4 h-4"} mr-1.5`} viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 18c-3.313 0-6-2.687-6-6s2.687-6 6-6 6 2.687 6 6-2.687 6-6 6z" />
            </svg>
          )
        };
      case "ea":
        return {
          bg: "bg-orange-950/60 border border-orange-800/40 text-orange-400",
          label: "EA App",
          icon: (
            <svg className={`${isSm ? "w-3 h-3" : "w-4 h-4"} mr-1.5`} viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0a12 12 0 1 0 12 12A12 12 0 0 0 12 0zm3 15h-6v-2h6v2zm0-4h-6V9h6v2z" />
            </svg>
          )
        };
      case "itch":
        return {
          bg: "bg-rose-950/60 border border-rose-800/40 text-rose-400",
          label: "itch.io",
          icon: (
            <svg className={`${isSm ? "w-3 h-3" : "w-4 h-4"} mr-1.5`} viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0L2.1 4.5v11.7L12 24l9.9-7.8V4.5L12 0zm5.4 14.4h-3.6v3.6h-3.6v-3.6H6.6v-3.6h3.6V7.2h3.6v3.6h3.6v3.6z" />
            </svg>
          )
        };
      case "manual":
      default:
        return {
          bg: "bg-amber-950/60 border border-amber-800/40 text-amber-400",
          label: "Manual",
          icon: (
            <svg className={`${isSm ? "w-3 h-3" : "w-4 h-4"} mr-1.5`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="6" width="20" height="12" rx="2" />
              <path d="M6 12h4M8 10v4M15 11h.01M18 13h.01" />
            </svg>
          )
        };
    }
  };

  const { bg, label, icon } = getSourceStyles();

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium tracking-wide shadow-sm select-none ${bg} ${
        isSm ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"
      }`}
    >
      {icon}
      {label}
    </span>
  );
};
