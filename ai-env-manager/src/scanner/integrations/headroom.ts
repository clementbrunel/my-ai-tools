import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { Integration, McpServer } from "../../types.js";
import { isCommandAvailable, detectPlugin } from "../../utils.js";

const HEADROOM_BASE = {
  name: "Headroom",
  description: "Context compression — reduces token usage of tool outputs and RAG chunks",
} as const;

function isHeadroomPythonAvailable(): boolean {
  try {
    execSync("python -m headroom --help", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function findHeadroomConfig(projectPath: string): string | null {
  const candidates = [
    join(projectPath, ".headroom.toml"),
    join(projectPath, "headroom.toml"),
    join(homedir(), ".headroom.toml"),
  ];
  return candidates.find(existsSync) ?? null;
}

function collectHeadroomSignals(
  projectPath: string,
  mcpServers: McpServer[]
): string[] {
  const signals: string[] = [];

  if (isCommandAvailable("headroom")) signals.push("binary in PATH");
  else if (isHeadroomPythonAvailable()) signals.push("python -m headroom available");

  const mcpMatch = mcpServers.find(
    (s) =>
      /headroom/i.test(s.name) ||
      (s.command ? /headroom/i.test(s.command) : false) ||
      (s.args?.some((a) => /headroom/i.test(a)) ?? false)
  );
  if (mcpMatch) signals.push(`MCP server: ${mcpMatch.name}`);

  const config = findHeadroomConfig(projectPath);
  if (config) signals.push(`config: ${config}`);

  const envVars = ["HEADROOM_OUTPUT_SHAPER", "HEADROOM_EMBEDDER_RUNTIME"];
  for (const v of envVars) {
    if (process.env[v]) signals.push(`env: ${v}`);
  }

  return signals;
}

export function detectHeadroom(projectPath: string, mcpServers: McpServer[]): Integration {
  const pluginResult = detectPlugin(/headroom/i, "headroom");
  if (pluginResult.detected) {
    const binaryOk = isCommandAvailable("headroom") || isHeadroomPythonAvailable();
    return {
      ...HEADROOM_BASE,
      detected: true,
      source: `plugin: ${pluginResult.source}`,
      status: binaryOk ? "ok" : "warning",
      diagnostics: binaryOk ? [] : ["Plugin installed but 'headroom' binary not found in PATH"],
    };
  }

  const signals = collectHeadroomSignals(projectPath, mcpServers);

  if (signals.length === 0) {
    return {
      ...HEADROOM_BASE,
      detected: false,
      status: "warning",
      diagnostics: ["Not detected: no headroom binary, MCP server, config file, or env vars"],
    };
  }

  const binaryOk = isCommandAvailable("headroom") || isHeadroomPythonAvailable();
  return {
    ...HEADROOM_BASE,
    detected: true,
    source: signals.join(", "),
    status: binaryOk ? "ok" : "warning",
    diagnostics: binaryOk ? [] : ["'headroom' binary not found in PATH — proxy/library mode may still work"],
  };
}
