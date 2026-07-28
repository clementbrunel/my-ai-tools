import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { Integration } from "../../types.js";
import { detectPlugin } from "../../utils.js";

const KARPATHY_BASE = {
  name: "Andrej Karpathy Skills",
  description: "Coding-discipline guidelines (no assumptions, surgical changes, verifiable goals)",
} as const;

function fileContainsKarpathy(filePath: string): boolean {
  try {
    return /karpathy/i.test(readFileSync(filePath, "utf-8"));
  } catch {
    return false;
  }
}

function collectKarpathySignals(projectPath: string): string[] {
  const signals: string[] = [];

  const cursorRule = join(projectPath, ".cursor", "rules", "karpathy-guidelines.mdc");
  if (existsSync(cursorRule)) signals.push(`Cursor rule: ${cursorRule}`);

  const claudeMdCandidates = [
    join(projectPath, "CLAUDE.md"),
    join(homedir(), ".claude", "CLAUDE.md"),
  ];
  for (const p of claudeMdCandidates) {
    if (existsSync(p) && fileContainsKarpathy(p)) signals.push(`referenced in ${p}`);
  }

  return signals;
}

export function detectKarpathySkills(projectPath: string): Integration {
  const pluginResult = detectPlugin(/karpathy/i, "andrej-karpathy-skills");
  if (pluginResult.detected) {
    return {
      ...KARPATHY_BASE,
      detected: true,
      source: `plugin: ${pluginResult.source}`,
      status: "ok",
      diagnostics: [],
    };
  }

  const signals = collectKarpathySignals(projectPath);

  if (signals.length === 0) {
    return {
      ...KARPATHY_BASE,
      detected: false,
      status: "warning",
      diagnostics: ["Not detected: no plugin, no Cursor rule, no reference in CLAUDE.md"],
    };
  }

  return {
    ...KARPATHY_BASE,
    detected: true,
    source: signals.join(", "),
    status: "ok",
    diagnostics: [],
  };
}
