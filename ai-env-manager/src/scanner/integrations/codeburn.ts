import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { Integration, McpServer } from "../../types.js";
import { isCommandAvailable } from "../../utils.js";

const CODEBURN_BASE = {
  name: "CodeBurn",
  description: "Suivi des coûts et de la consommation de tokens des agents de code IA",
} as const;

function findCodeBurnConfig(): string | null {
  const candidates = [
    join(homedir(), ".config", "codeburn", "config.json"),
    join(homedir(), ".config", "codeburn", "guard.json"),
  ];
  return candidates.find(existsSync) ?? null;
}

function collectCodeBurnSignals(mcpServers: McpServer[]): string[] {
  const signals: string[] = [];

  if (isCommandAvailable("codeburn")) signals.push("binary in PATH");

  const mcpMatch = mcpServers.find(
    (s) =>
      /codeburn/i.test(s.name) ||
      (s.command ? /codeburn/i.test(s.command) : false) ||
      (s.args?.some((a) => /codeburn/i.test(a)) ?? false)
  );
  if (mcpMatch) signals.push(`MCP server: ${mcpMatch.name}`);

  const config = findCodeBurnConfig();
  if (config) signals.push(`config: ${config}`);

  return signals;
}

export function detectCodeBurn(mcpServers: McpServer[]): Integration {
  const signals = collectCodeBurnSignals(mcpServers);

  if (signals.length === 0) {
    return {
      ...CODEBURN_BASE,
      detected: false,
      status: "warning",
      diagnostics: ["Not detected: no codeburn binary, MCP server, or config file"],
    };
  }

  const binaryOk = isCommandAvailable("codeburn");
  return {
    ...CODEBURN_BASE,
    detected: true,
    source: signals.join(", "),
    status: binaryOk ? "ok" : "warning",
    diagnostics: binaryOk ? [] : ["'codeburn' binary not found in PATH — MCP server may still work via npx"],
  };
}
