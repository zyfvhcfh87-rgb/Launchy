import { convertFileSrc } from "@tauri-apps/api/core";

// Check if Tauri is present
const isTauriEnv = typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__ !== undefined;

export const getArtworkUrl = (path: string | null): string => {
  if (!path) return "";
  const trimmed = path.trim();
  if (!trimmed) return "";
  
  // If it's a web URL (starts with http:// or https:// or data:), return it directly
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:")
  ) {
    return trimmed;
  }
  
  // Otherwise, it is treated as a local absolute file path
  if (isTauriEnv) {
    try {
      return convertFileSrc(trimmed);
    } catch (e) {
      console.error("Failed to convert file source:", e);
      return "";
    }
  }
  
  // For web mock fallbacks, return standard path
  return trimmed;
};
