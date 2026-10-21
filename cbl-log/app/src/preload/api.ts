import type { LogFormat, ParseRuleSetResult, RuleSet, Session, Settings } from "@cbl-log/shared";

/** API exposed to the renderer through contextBridge (`window.cblLog`). */
export interface CblLogApi {
  readonly version: string;
  /** Shows the native open dialog; resolves with the chosen paths (empty if cancelled). */
  openFileDialog(): Promise<string[]>;
  /** Paths the main process wants opened (menu, command line, second instance). */
  onOpenFiles(cb: (paths: string[]) => void): () => void;
  /** Filesystem path of a dropped `File` (empty for non-file items). */
  getPathForFile(file: File): string;
  /** Tells the main process the renderer is listening: queued paths are then delivered. */
  notifyReady(): void;
  /** Records a successfully opened file in the "Fichiers récents" menu (recent.json). */
  addRecentFile(path: string): Promise<void>;
  /** Native context menu for a file (open its folder, show it in the file manager, copy its path). */
  showFileContextMenu(path: string): Promise<void>;
  /** Highlighting rule sets from the user data folder (the default set is created on first run). */
  loadRuleSets(): Promise<{ sets: RuleSet[]; warnings: string[] }>;
  saveRuleSet(set: RuleSet): Promise<void>;
  /** Save dialog + write, to share a profile; resolves with the path written (undefined if cancelled). */
  exportRuleSet(set: RuleSet): Promise<string | undefined>;
  /** Open dialog + validation of a shared profile file (undefined if cancelled); nothing is stored yet. */
  importRuleSet(): Promise<ParseRuleSetResult | undefined>;
  /** settings.json (a missing file gives the defaults; an unusable one is reported in `warning`). */
  loadSettings(): Promise<{ value: Settings; warning?: string }>;
  saveSettings(settings: Settings): Promise<void>;
  loadSession(): Promise<{ value: Session; warning?: string }>;
  saveSession(session: Session): Promise<void>;
  /** A config file was edited outside the app (hot reload). */
  onConfigChanged(cb: (kind: "settings" | "rules" | "formats") => void): () => void;
  /** User log formats from the formats folder (built-in ones come with the app). */
  loadFormats(): Promise<{ formats: LogFormat[]; warnings: string[] }>;
}
