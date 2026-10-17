// Hot reload of the config folder: reports external edits of settings.json and rules/*.json, and
// ignores the changes the app made itself (same content as its last write).
import { watch, type FSWatcher } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type ConfigKind = "settings" | "rules";

export const WATCH_DEBOUNCE_MS = 300;

/** Config kind of a path relative to the config folder, undefined for files we do not care about. */
export function classifyConfigFile(relativePath: string): ConfigKind | undefined {
  const normalized = relativePath.split(String.fromCharCode(92)).join("/");
  if (normalized === "settings.json") return "settings";
  if (/^rules\/[^/]+\.json$/.test(normalized)) return "rules";
  return undefined;
}

export class ConfigWatcher {
  private watcher: FSWatcher | undefined;
  private readonly written = new Map<string, string>();
  private readonly pending = new Set<string>();
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly dir: string,
    private readonly onChange: (kind: ConfigKind) => void,
    private readonly debounceMs = WATCH_DEBOUNCE_MS,
  ) {}

  /** Remember what the app just wrote, so the resulting file event is not reported. */
  noteWrite(relativePath: string, text: string): void {
    this.written.set(relativePath.split(String.fromCharCode(92)).join("/"), text);
  }

  start(): void {
    if (this.watcher) return;
    try {
      this.watcher = watch(this.dir, { recursive: true, persistent: false }, (_event, filename) => {
        if (!filename) return;
        const name = String(filename).split(String.fromCharCode(92)).join("/");
        if (!classifyConfigFile(name)) return;
        this.pending.add(name);
        clearTimeout(this.timer);
        this.timer = setTimeout(() => void this.flush(), this.debounceMs);
      });
      this.watcher.on("error", () => this.stop());
    } catch {
      // folder missing or watching unsupported: reload only happens at startup
    }
  }

  stop(): void {
    clearTimeout(this.timer);
    this.watcher?.close();
    this.watcher = undefined;
  }

  private async flush(): Promise<void> {
    const names = [...this.pending];
    this.pending.clear();
    const kinds = new Set<ConfigKind>();
    for (const name of names) {
      const kind = classifyConfigFile(name);
      if (!kind) continue;
      let text: string | undefined;
      try {
        text = await readFile(join(this.dir, name), "utf8");
      } catch {
        text = undefined; // deleted
      }
      if (text !== undefined && this.written.get(name) === text) continue; // our own write
      kinds.add(kind);
    }
    for (const kind of kinds) this.onChange(kind);
  }
}
