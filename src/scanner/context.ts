import { existsSync, statSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { homedir } from "node:os";
import type { ContextFile } from "../types.js";

function checkFile(
  filePath: string,
  scope: ContextFile["scope"]
): ContextFile | null {
  const exists = existsSync(filePath);
  return {
    path: filePath,
    exists,
    sizeBytes: exists ? statSync(filePath).size : 0,
    scope,
  };
}

export function scanContextFiles(projectPath: string): ContextFile[] {
  const results: ContextFile[] = [];
  const absPath = resolve(projectPath);
  const home = homedir();

  // 1. Project-level CLAUDE.md
  const projectClaudeMd = join(absPath, "CLAUDE.md");
  results.push(checkFile(projectClaudeMd, "project")!);

  // 2. Project-level .claude/ directory contents
  const claudeDir = join(absPath, ".claude");
  if (existsSync(claudeDir) && statSync(claudeDir).isDirectory()) {
    try {
      const entries = readdirSync(claudeDir);
      for (const entry of entries) {
        if (entry === "settings.json") continue; // handled by MCP scanner
        const entryPath = join(claudeDir, entry);
        if (statSync(entryPath).isFile()) {
          results.push({
            path: entryPath,
            exists: true,
            sizeBytes: statSync(entryPath).size,
            scope: "project",
          });
        }
      }
    } catch {
      // ignore permission errors
    }
  }

  // 3. Walk up to find parent CLAUDE.md files (up to home dir)
  let current = dirname(absPath);
  while (current !== home && current !== "/" && current !== dirname(current)) {
    const parentClaudeMd = join(current, "CLAUDE.md");
    if (existsSync(parentClaudeMd)) {
      results.push(checkFile(parentClaudeMd, "parent")!);
    }
    current = dirname(current);
  }

  // 4. User-level CLAUDE.md in home
  const homeClaudeMd = join(home, "CLAUDE.md");
  if (absPath !== home) {
    results.push(checkFile(homeClaudeMd, "user")!);
  }

  // 5. .clauderc
  const claudeRc = join(absPath, ".clauderc");
  if (existsSync(claudeRc)) {
    results.push(checkFile(claudeRc, "project")!);
  }

  return results.filter((f) => f.exists);
}
