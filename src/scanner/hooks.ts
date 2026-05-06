import { readFileSync, existsSync, accessSync, constants } from "node:fs";
import { execSync } from "node:child_process";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import type { Hook, Status } from "../types.js";

interface HookEntry {
  type: string;
  command: string;
}

interface HookMatcher {
  matcher: string;
  hooks: HookEntry[];
}

interface SettingsFile {
  hooks?: Record<string, HookMatcher[]>;
}

function parseJsonFile<T>(filePath: string): T | null {
  try {
    if (!existsSync(filePath)) return null;
    const content = readFileSync(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

function isScriptExecutable(command: string): boolean {
  // The hook command may be a path to a script, or an inline shell command.
  // Strategy: if it looks like a path (starts with /, ~, ./), validate it as a
  // file. Otherwise, extract the first token and check it against PATH.
  const trimmed = command.trim();
  const looksLikePath = /^(\/|~|\.\/)/.test(trimmed);

  if (looksLikePath) {
    try {
      const resolved = trimmed.startsWith("~")
        ? join(homedir(), trimmed.slice(1).split(/\s+/)[0])
        : trimmed.split(/\s+/)[0];
      if (!existsSync(resolved)) return false;
      accessSync(resolved, constants.X_OK);
      return true;
    } catch {
      return false;
    }
  }

  // Shell command: check if the first token resolves in PATH
  const firstToken = trimmed.split(/\s+/)[0];
  if (!firstToken) return false;
  try {
    execSync(`which ${firstToken} 2>/dev/null`, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function parseMcpMatcher(matcher: string): { mcpServer?: string; mcpTool?: string } {
  if (!matcher.startsWith("mcp__")) return {};
  const parts = matcher.split("__");
  // format: mcp__<server>__<tool>  (parts: ["mcp", server, ...tool])
  if (parts.length >= 3) {
    return { mcpServer: parts[1], mcpTool: parts.slice(2).join("__") };
  }
  if (parts.length === 2 && parts[1]) {
    return { mcpServer: parts[1] };
  }
  return {};
}

function extractHooks(settings: SettingsFile, source: string): Hook[] {
  if (!settings.hooks) return [];
  const results: Hook[] = [];

  for (const [event, matchers] of Object.entries(settings.hooks)) {
    for (const matcher of matchers) {
      for (const hook of matcher.hooks) {
        const scriptExists =
          hook.type === "command" ? isScriptExecutable(hook.command) : null;

        const diagnostics: string[] = [];
        let status: Status = "ok";

        if (hook.type === "command" && scriptExists === false) {
          diagnostics.push(
            `Script not found or not executable: ${hook.command}`
          );
          status = "error";
        }

        const matcherStr = matcher.matcher || "*";
        const { mcpServer, mcpTool } = parseMcpMatcher(matcherStr);

        results.push({
          event,
          matcher: matcherStr,
          mcpServer,
          mcpTool,
          type: hook.type,
          command: hook.command,
          source,
          scriptExists,
          status,
          diagnostics,
        });
      }
    }
  }

  return results;
}

export function scanHooks(projectPath: string): Hook[] {
  const results: Hook[] = [];
  const absPath = resolve(projectPath);

  // 1. Project-level .claude/settings.json
  const projectSettingsPath = join(absPath, ".claude", "settings.json");
  const projectSettings = parseJsonFile<SettingsFile>(projectSettingsPath);
  if (projectSettings) {
    results.push(...extractHooks(projectSettings, ".claude/settings.json"));
  }

  // 2. User-level ~/.claude/settings.json
  const userSettingsPath = join(homedir(), ".claude", "settings.json");
  const userSettings = parseJsonFile<SettingsFile>(userSettingsPath);
  if (userSettings) {
    results.push(...extractHooks(userSettings, "~/.claude/settings.json"));
  }

  return results;
}
