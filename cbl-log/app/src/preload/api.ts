import type { LogFormat, ParseRuleSetResult, RuleSet, Session, Settings } from "@cbl-log/shared";

/** Report of "Aide > Signaler un bug / proposer une idée" (same shape as main/feedback.ts). */
export interface FeedbackDraft {
  kind: "bug" | "request";
  title: string;
  description: string;
  includeEnv: boolean;
}

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
  /** Native context menu for a file (open its folder, show it in the file manager, copy its path, designate an archive). */
  showFileContextMenu(path: string): Promise<void>;
  /** "Désigner une archive du rolling…" was chosen for `path` and `archive` picked in its folder. */
  onArchiveDesignated(cb: (path: string, archive: string) => void): () => void;
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
  /** "Aide > Signaler un bug / proposer une idée" was chosen. */
  onOpenFeedback(cb: () => void): () => void;
  /** Environment lines that can go in the report, and why a report cannot be opened now (anti-flood). */
  feedbackStatus(): Promise<{ env: string[]; blocked?: string }>;
  /** Opens the pre-filled GitHub issue in the browser; refused (with the reason) when invalid or too frequent. */
  submitFeedback(draft: FeedbackDraft): Promise<{ ok: true } | { ok: false; reason: string }>;
  /** User log formats from the formats folder (built-in ones come with the app). */
  loadFormats(): Promise<{ formats: LogFormat[]; warnings: string[] }>;
}
