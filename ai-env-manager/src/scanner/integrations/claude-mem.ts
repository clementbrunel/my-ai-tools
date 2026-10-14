import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { Integration } from "../../types.js";
import { detectPlugin } from "../../utils.js";

const CLAUDE_MEM_BASE = {
  name: "Claude-Mem",
  description: "Automatic cross-session memory — captures what the agent does, compresses it, re-injects it into new sessions",
} as const;

function fileMentionsClaudeMem(filePath: string): boolean {
  try {
    return /claude-mem/i.test(readFileSync(filePath, "utf-8"));
  } catch {
    return false;
  }
}

function collectClaudeMemSignals(projectPath: string): string[] {
  const signals: string[] = [];

  // Created with default values on first launch of the plugin.
  const settings = join(homedir(), ".claude-mem", "settings.json");
  if (existsSync(settings)) signals.push(`config: ${settings}`);

  for (const p of [join(projectPath, "CLAUDE.md"), join(homedir(), ".claude", "CLAUDE.md")]) {
    if (existsSync(p) && fileMentionsClaudeMem(p)) signals.push(`referenced in ${p}`);
  }

  return signals;
}

export function detectClaudeMem(projectPath: string): Integration {
  const pluginResult = detectPlugin(/claude-mem/i, "thedotmack");
  if (pluginResult.detected) {
    return {
      ...CLAUDE_MEM_BASE,
      detected: true,
      source: `plugin: ${pluginResult.source}`,
      status: "ok",
      diagnostics: [],
    };
  }

  const signals = collectClaudeMemSignals(projectPath);

  if (signals.length === 0) {
    return {
      ...CLAUDE_MEM_BASE,
      detected: false,
      status: "warning",
      diagnostics: [
        "Not detected: no claude-mem plugin, no ~/.claude-mem/settings.json, no reference in CLAUDE.md",
      ],
    };
  }

  return {
    ...CLAUDE_MEM_BASE,
    detected: true,
    source: signals.join(", "),
    status: "ok",
    diagnostics: [],
  };
}
