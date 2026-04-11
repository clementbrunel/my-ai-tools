import { existsSync, statSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { homedir } from "node:os";
import type { ContextFile, Status } from "../types.js";

const TOKEN_WARNING = 500;
const TOKEN_ERROR = 1000;

function tokenStatus(tokens: number): Status {
  if (tokens >= TOKEN_ERROR) return "error";
  if (tokens >= TOKEN_WARNING) return "warning";
  return "ok";
}

function estimateTokens(filePath: string): number {
  try {
    const content = readFileSync(filePath, "utf-8");
    // Heuristic: ~4 characters per token for English text.
    // Claude tokenizer is close to this for typical markdown content.
    return Math.ceil(content.length / 4);
  } catch {
    return 0;
  }
}

function checkFile(
  filePath: string,
  scope: ContextFile["scope"]
): ContextFile | null {
  const exists = existsSync(filePath);
  const tokens = exists ? estimateTokens(filePath) : 0;
  return {
    path: filePath,
    exists,
    sizeBytes: exists ? statSync(filePath).size : 0,
    estimatedTokens: tokens,
    scope,
    status: tokenStatus(tokens),
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
          const tokens = estimateTokens(entryPath);
          results.push({
            path: entryPath,
            exists: true,
            sizeBytes: statSync(entryPath).size,
            estimatedTokens: tokens,
            scope: "project",
            status: tokenStatus(tokens),
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
