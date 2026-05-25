import { PluginInfo } from "../types/game";

export class LaunchyPluginAPI {
  /**
   * Fetch a list of all installed plugins and their enabled status
   */
  static async getPlugins(): Promise<PluginInfo[]> {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke<PluginInfo[]>("get_plugins");
    } catch (err) {
      console.error("Failed to fetch plugins:", err);
      return [];
    }
  }

  /**
   * Toggle the enabled/disabled state of a plugin
   */
  static async togglePlugin(id: string, enabled: boolean): Promise<boolean> {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("toggle_plugin", { id, enabled });
      return true;
    } catch (err) {
      console.error(`Failed to toggle plugin ${id}:`, err);
      return false;
    }
  }

  /**
   * Run a custom script plugin event
   * @param id The plugin ID (folder name)
   * @param event The event action name (e.g. "scrape", "scan")
   * @param payload JSON string payload argument passed to the plugin subprocess
   */
  static async executePlugin(id: string, event: string, payload?: string): Promise<string> {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke<string>("execute_plugin", { id, event, payload: payload || null });
    } catch (err) {
      console.error(`Failed to execute plugin ${id}:`, err);
      throw err;
    }
  }

  /**
   * Seed standard Python and JS boilerplate plugins inside the plugins folder
   */
  static async installSamplePlugins(): Promise<boolean> {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("create_sample_plugin");
      return true;
    } catch (err) {
      console.error("Failed to install sample plugins:", err);
      return false;
    }
  }
}
