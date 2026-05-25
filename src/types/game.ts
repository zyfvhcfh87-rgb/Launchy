export type GameStatus =
  | "installed"
  | "missing"
  | "launching"
  | "running"
  | "needs_client"
  | "error";

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
