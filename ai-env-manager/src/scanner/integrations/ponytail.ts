import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir, platform } from "node:os";
import type { Integration } from "../../types.js";
import { detectPlugin } from "../../utils.js";

const PONYTAIL_BASE = {
  name: "Ponytail",
  description: "Skill anti-sur-ingénierie — pousse l'agent vers l'implémentation minimale nécessaire",
} as const;

function fileContainsPonytail(filePath: string): boolean {
  try {
    return /ponytail/i.test(readFileSync(filePath, "utf-8"));
  } catch {
    return false;
  }
}

function configPath(): string {
  return platform() === "win32"
    ? join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "ponytail", "config.json")
    : join(homedir(), ".config", "ponytail", "config.json");
}

function collectPonytailSignals(projectPath: string): string[] {
  const signals: string[] = [];

  const config = configPath();
  if (existsSync(config)) signals.push(`config: ${config}`);

  if (process.env.PONYTAIL_DEFAULT_MODE) {
    signals.push(`env: PONYTAIL_DEFAULT_MODE=${process.env.PONYTAIL_DEFAULT_MODE}`);
  }

  const ruleFileCandidates = [
    join(projectPath, ".cursor", "rules", "ponytail.mdc"),
    join(projectPath, ".windsurf", "rules", "ponytail.md"),
    join(projectPath, ".clinerules", "ponytail.md"),
  ];
  for (const p of ruleFileCandidates) {
    if (existsSync(p)) signals.push(`rule file: ${p}`);
  }

  const textFileCandidates = [
    join(projectPath, ".github", "copilot-instructions.md"),
    join(projectPath, "AGENTS.md"),
    join(projectPath, "CLAUDE.md"),
    join(homedir(), ".claude", "CLAUDE.md"),
  ];
  for (const p of textFileCandidates) {
    if (existsSync(p) && fileContainsPonytail(p)) signals.push(`referenced in ${p}`);
  }

  return signals;
}

export function detectPonytail(projectPath: string): Integration {
  const pluginResult = detectPlugin(/ponytail/i, "ponytail");
  if (pluginResult.detected) {
    return {
      ...PONYTAIL_BASE,
      detected: true,
      source: `plugin: ${pluginResult.source}`,
      status: "ok",
      diagnostics: [],
    };
  }

  const signals = collectPonytailSignals(projectPath);

  if (signals.length === 0) {
    return {
      ...PONYTAIL_BASE,
      detected: false,
      status: "warning",
      diagnostics: [
        "Not detected: no plugin, no rule file (.cursor/.windsurf/.clinerules), no reference in CLAUDE.md/AGENTS.md/copilot-instructions.md, no config file, no PONYTAIL_DEFAULT_MODE env var",
      ],
    };
  }

  return {
    ...PONYTAIL_BASE,
    detected: true,
    source: signals.join(", "),
    status: "ok",
    diagnostics: [],
  };
}
