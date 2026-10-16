import { existsSync } from "node:fs";
import nodePath from "node:path";

export interface ParseFileArgsOptions {
  /** Packaged app: argv is [exe, ...args]. Dev: argv is [electron, appPath, ...args]. */
  isPackaged: boolean;
  /** File existence check, injectable for tests. */
  exists?: (path: string) => boolean;
  /** Path flavour, injectable for tests (default: the host's `node:path`). */
  path?: Pick<typeof nodePath, "resolve">;
}

/**
 * Extracts the log files to open from a process command line: skips the executable (and the app
 * path in dev), ignores `--flags` (Chromium adds some), resolves relative paths against `cwd`
 * and keeps only existing entries, without duplicates.
 */
export function parseFileArgs(argv: readonly string[], cwd: string, options: ParseFileArgsOptions): string[] {
  const exists = options.exists ?? existsSync;
  const pathApi = options.path ?? nodePath;
  const candidates: string[] = [];
  let appPathSkipped = options.isPackaged;
  for (const arg of argv.slice(1)) {
    if (arg === "" || arg.startsWith("--")) continue;
    if (!appPathSkipped) {
      appPathSkipped = true;
      continue;
    }
    candidates.push(arg);
  }
  const out: string[] = [];
  for (const arg of candidates) {
    const resolved = pathApi.resolve(cwd, arg);
    if (exists(resolved) && !out.includes(resolved)) out.push(resolved);
  }
  return out;
}
