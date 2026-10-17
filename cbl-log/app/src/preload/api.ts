import type { RuleSet } from "@cbl-log/shared";

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
  /** Highlighting rule sets from the user data folder (the default set is created on first run). */
  loadRuleSets(): Promise<{ sets: RuleSet[]; warnings: string[] }>;
  saveRuleSet(set: RuleSet): Promise<void>;
}
