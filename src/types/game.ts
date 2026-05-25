export type GameStatus =
  | "installed"
  | "missing"
  | "launching"
  | "running"
  | "needs_client"
  | "error";

export interface GameArtwork {
  game_id: string;
  cover_path: string | null;
  hero_path: string | null;
  logo_path: string | null;
  icon_path: string | null;
  source: string;
  updated_at: string;
}

export interface Game {
  id: string;
  source: "steam" | "epic" | "manual";
  source_app_id: string | null;
  title: string;
  install_path: string | null;
  launch_method: "uri" | "exec";
  launch_uri: string | null;
  launch_exe: string | null;
  launch_args: string | null;
  artwork_path: string | null;
  status: GameStatus;
  favorite: boolean;
  hidden: boolean;
  last_played_at: string | null;
  playtime_seconds: number;
  created_at: string;
  updated_at: string;
  artwork?: GameArtwork | null;
  description?: string | null;
  release_date?: string | null;
  genres?: string | null;
  developer?: string | null;
  esrb_rating?: string | null;
  runner_type?: string | null;
  runner_path?: string | null;
  runner_prefix?: string | null;
}


export interface LibrarySource {
  id: string;
  source: "steam" | "epic" | "manual";
  detected_path: string;
  enabled: boolean;
  last_scan_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PluginManifest {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  entry: string;
  plugin_type: string;
}

export interface PluginInfo {
  manifest: PluginManifest;
  path: string;
  enabled: boolean;
}

export interface PlaytimeSession {
  id: string;
  game_id: string;
  game_title: string;
  cover_path: string | null;
  playtime_seconds: number;
  played_at: string;
}

export interface Category {
  id: string;
  name: string;
  created_at: string;
  game_ids: string[];
}
