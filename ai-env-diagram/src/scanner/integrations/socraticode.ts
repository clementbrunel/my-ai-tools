import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import type { Integration, McpServer } from "../../types.js";
import { isCommandAvailable, detectPlugin } from "../../utils.js";

const SOCRATICODE_BASE = {
  name: "SocratiCode",
  description: "Codebase indexing MCP server — semantic search, dependency graphs, symbol impact analysis",
} as const;

function isSocratiCodeDockerRunning(): boolean {
  try {
    const output = execSync("docker ps --format '{{.Names}}' 2>/dev/null", { stdio: "pipe", encoding: "utf-8" });
    return /socraticode/i.test(output);
  } catch {
    return false;
  }
}

function collectSocratiCodeSignals(
  projectPath: string,
  mcpServers: McpServer[]
): string[] {
  const signals: string[] = [];

  const mcpMatch = mcpServers.find(
    (s) =>
      /socrati.?code/i.test(s.name) ||
      /socrati/i.test(s.name) ||
      (s.command ? /socrati/i.test(s.command) : false) ||
      (s.args?.some((a) => /socrati/i.test(a)) ?? false)
  );
  if (mcpMatch) signals.push(`MCP server: ${mcpMatch.name}`);

  if (isCommandAvailable("socraticode")) signals.push("binary in PATH");

  if (existsSync(join(projectPath, ".socraticodeignore"))) {
    signals.push(".socraticodeignore at project root");
  }

  if (isSocratiCodeDockerRunning()) signals.push("Docker container running");

  return signals;
}

export function detectSocratiCode(projectPath: string, mcpServers: McpServer[]): Integration {
  const pluginResult = detectPlugin(/socrati.?code/i, "socraticode");
  if (pluginResult.detected) {
    const mcpMatch = mcpServers.find((s) => /socrati/i.test(s.name));
    const dockerOk = isSocratiCodeDockerRunning();
    const diagnostics: string[] = [];
    if (!mcpMatch) diagnostics.push("Plugin installed but no MCP server entry found — check your MCP config");
    if (!dockerOk) diagnostics.push("SocratiCode Docker container not running — start it before indexing");
    return {
      ...SOCRATICODE_BASE,
      detected: true,
      source: `plugin: ${pluginResult.source}`,
      status: diagnostics.length === 0 ? "ok" : "warning",
      diagnostics,
    };
  }

  const signals = collectSocratiCodeSignals(projectPath, mcpServers);

  if (signals.length === 0) {
    return {
      ...SOCRATICODE_BASE,
      detected: false,
      status: "warning",
      diagnostics: [
        "Not detected: no MCP server, no socraticode binary, no .socraticodeignore, no Docker container",
      ],
    };
  }

  const dockerOk = isSocratiCodeDockerRunning();
  const hasMcp = signals.some((s) => s.startsWith("MCP server"));
  const diagnostics: string[] = [];
  if (!dockerOk && !hasMcp) diagnostics.push("Docker container not running — SocratiCode may be inactive");

  return {
    ...SOCRATICODE_BASE,
    detected: true,
    source: signals.join(", "),
    status: diagnostics.length === 0 ? "ok" : "warning",
    diagnostics,
  };
}
