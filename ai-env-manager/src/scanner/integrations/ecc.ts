import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { Integration, McpServer, Status } from "../../types.js";
import { detectPlugin } from "../../utils.js";

const ECC_BASE = {
  name: "ECC",
  description: "Agent harness OS — 67 agents, 271 skills, hooks and rules for AI coding tools",
} as const;

const ECC_ENV_VARS = ["ECC_HOOK_PROFILE", "ECC_SESSION_START_MAX_CHARS", "ECC_DISABLED_HOOKS"];

function fileContainsEcc(filePath: string): boolean {
  try {
    return /\becc\b/i.test(readFileSync(filePath, "utf-8"));
  } catch {
    return false;
  }
}

function collectEccSignals(
  projectPath: string,
  mcpServers: McpServer[]
): string[] {
  const signals: string[] = [];

  const mcpMatch = mcpServers.find(
    (s) =>
      /^ecc$/i.test(s.name) ||
      (s.command ? /\becc\b/i.test(s.command) : false)
  );
  if (mcpMatch) signals.push(`MCP server: ${mcpMatch.name}`);

  for (const v of ECC_ENV_VARS) {
    if (process.env[v]) signals.push(`env: ${v}`);
  }

  const filesToCheck = [
    join(projectPath, "CLAUDE.md"),
    join(projectPath, ".claude", "settings.json"),
    join(homedir(), ".claude", "CLAUDE.md"),
  ];
  for (const p of filesToCheck) {
    if (existsSync(p) && fileContainsEcc(p)) signals.push(`referenced in ${p}`);
  }

  return signals;
}

export function detectEcc(projectPath: string, mcpServers: McpServer[]): Integration {
  const pluginResult = detectPlugin(/^ecc$/i, "ecc");
  if (pluginResult.detected) {
    const envProfileSet = !!process.env["ECC_HOOK_PROFILE"];
    const status: Status = "ok";
    const diagnostics: string[] = [];
    if (!envProfileSet) diagnostics.push("ECC_HOOK_PROFILE not set — default hook profile will be used");
    return {
      ...ECC_BASE,
      detected: true,
      source: `plugin: ${pluginResult.source}`,
      status,
      diagnostics,
      detail: process.env["ECC_HOOK_PROFILE"],
    };
  }

  const signals = collectEccSignals(projectPath, mcpServers);

  if (signals.length === 0) {
    return {
      ...ECC_BASE,
      detected: false,
      status: "warning",
      diagnostics: ["Not detected: no ECC plugin, MCP server, env vars, or references in CLAUDE.md"],
    };
  }

  return {
    ...ECC_BASE,
    detected: true,
    source: signals.join(", "),
    status: "ok",
    diagnostics: [],
    detail: process.env["ECC_HOOK_PROFILE"],
  };
}
