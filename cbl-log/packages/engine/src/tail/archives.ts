// Archives of a rolled log (T-08, T-09): the files the writer left next to the live one, e.g.
// `SystemOut.log` → `SystemOut_26.10.21_09.30.46.log` (WebSphere), `messages_26.10.21_09.30.46.0.log`
// (Liberty), `app.2026-10-21.0.log` (Logback), `app.log.1`. They are found by name, ordered by
// modification time (= when the writer left them), and loaded before the live file within a time
// budget.
import { readdir, stat } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { escapeRegExp } from "@cbl-log/shared";

const MAX_DIR_ENTRIES = 5000;

export interface ArchiveFile {
  path: string;
  size: number;
  mtimeMs: number;
}

export interface ArchiveScan {
  /** Archives modified within the budget, oldest first. */
  loaded: ArchiveFile[];
  /** Older archives left out by the budget. */
  skipped: number;
}

export interface FindArchivesOptions {
  /** Regex (source) the archive NAMES must match entirely, e.g. learned by `learnArchivePattern`. */
  pattern?: string | undefined;
  /** Archives last modified before this time (ms since epoch) are skipped. */
  since?: number;
}

/**
 * Default rule: `<stem><sep><suffix><ext>` (same extension as the live file, a suffix holding a digit),
 * or `<live name>.<digits>`. Compressed archives (.gz) are not read.
 */
export function defaultArchivePattern(livePath: string): string {
  const name = basename(livePath);
  const ext = extname(name);
  const stem = ext ? name.slice(0, -ext.length) : name;
  const dated = `${escapeRegExp(stem)}[._-][\\w.-]*\\d[\\w.-]*${escapeRegExp(ext)}`;
  const numbered = `${escapeRegExp(name)}\\.\\d+`;
  return `(?:${dated}|${numbered})`;
}

/** Archives of `livePath` in its directory, oldest first; never rejects (an unreadable directory = none). */
export async function findArchives(livePath: string, options: FindArchivesOptions = {}): Promise<ArchiveScan> {
  let re: RegExp;
  try {
    re = new RegExp(`^(?:${options.pattern ?? defaultArchivePattern(livePath)})$`, "i");
  } catch {
    return { loaded: [], skipped: 0 };
  }
  const dir = dirname(livePath);
  const live = basename(livePath).toLowerCase();
  let names: string[];
  try {
    names = (await readdir(dir)).slice(0, MAX_DIR_ENTRIES);
  } catch {
    return { loaded: [], skipped: 0 };
  }
  const found: ArchiveFile[] = [];
  for (const name of names) {
    if (name.toLowerCase() === live || !re.test(name)) continue;
    const path = join(dir, name);
    try {
      const st = await stat(path);
      if (st.isFile()) found.push({ path, size: st.size, mtimeMs: st.mtimeMs });
    } catch {
      // vanished meanwhile
    }
  }
  found.sort((a, b) => a.mtimeMs - b.mtimeMs || a.path.localeCompare(b.path));
  const since = options.since ?? -Infinity;
  const loaded = found.filter((f) => f.mtimeMs >= since);
  return { loaded, skipped: found.length - loaded.length };
}
