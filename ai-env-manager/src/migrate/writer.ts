import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { MigrationFile } from "./bundle.js";

export type WriteAction = "created" | "updated" | "unchanged";

export interface WriteOutcome {
  name: string;
  path: string;
  action: WriteAction;
}

export interface WriteResult {
  outcomes: WriteOutcome[];
  /** Set only when at least one existing file was backed up. */
  backupDir?: string;
}

function timestamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
}

/**
 * Writes the migration bundle, backing up any file it is about to overwrite.
 *
 * Only the files being replaced are copied — backing up the whole target
 * directory would recurse, since `backups/` lives inside it.
 */
export function writeMigration(
  targetDir: string,
  files: MigrationFile[],
  now: Date = new Date()
): WriteResult {
  mkdirSync(targetDir, { recursive: true });

  const existing = files.filter((f) => existsSync(join(targetDir, f.name)));
  let backupDir: string | undefined;
  if (existing.length > 0) {
    backupDir = join(targetDir, "backups", timestamp(now));
    mkdirSync(backupDir, { recursive: true });
    for (const file of existing) {
      copyFileSync(join(targetDir, file.name), join(backupDir, file.name));
    }
  }

  const outcomes = files.map<WriteOutcome>((file) => {
    const path = join(targetDir, file.name);
    const existed = existsSync(path);
    const unchanged = existed && readFileSync(path, "utf-8") === file.content;
    if (!unchanged) writeFileSync(path, file.content, "utf-8");
    return { name: file.name, path, action: unchanged ? "unchanged" : existed ? "updated" : "created" };
  });

  return { outcomes, backupDir };
}
