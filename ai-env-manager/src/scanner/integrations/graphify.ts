import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { Integration, McpServer } from "../../types.js";
import { isCommandAvailable } from "../../utils.js";

const GRAPHIFY_BASE = {
  name: "Graphify",
  description: "Codebase-to-knowledge-graph tool — tree-sitter AST parsing plus semantic doc/PDF extraction, queryable instead of grepped",
  pipPackage: "graphifyy",
} as const;

function collectGraphifySignals(
  projectPath: string,
  mcpServers: McpServer[]
): string[] {
  const signals: string[] = [];

  if (isCommandAvailable("graphify")) signals.push("binary in PATH");

  const mcpMatch = mcpServers.find(
    (s) =>
      /graphify/i.test(s.name) ||
      (s.command ? /graphify/i.test(s.command) : false) ||
      (s.args?.some((a) => /graphify/i.test(a)) ?? false)
  );
  if (mcpMatch) signals.push(`MCP server: ${mcpMatch.name}`);

  if (existsSync(join(projectPath, ".claude", "skills", "graphify", "SKILL.md"))) {
    signals.push(".claude/skills/graphify/SKILL.md");
  }

  if (existsSync(join(projectPath, ".graphifyignore"))) {
    signals.push(".graphifyignore at project root");
  }

  if (existsSync(join(projectPath, "graphify-out", "graph.json"))) {
    signals.push("graphify-out/graph.json (built graph)");
  }

  if (existsSync(join(homedir(), ".graphify", "global-graph.json"))) {
    signals.push("~/.graphify/global-graph.json");
  }

  return signals;
}

export function detectGraphify(projectPath: string, mcpServers: McpServer[]): Integration {
  const signals = collectGraphifySignals(projectPath, mcpServers);

  if (signals.length === 0) {
    return {
      ...GRAPHIFY_BASE,
      detected: false,
      status: "warning",
      diagnostics: [
        "Not detected: no graphify binary, no MCP server, no .claude/skills/graphify/SKILL.md, no .graphifyignore, no graphify-out/graph.json",
      ],
    };
  }

  const binaryOk = isCommandAvailable("graphify");
  const hasBuiltGraph = signals.some((s) => s.startsWith("graphify-out"));
  const diagnostics: string[] = [];
  if (!binaryOk) diagnostics.push("'graphify' binary not found in PATH");
  if (!hasBuiltGraph) diagnostics.push("No graph built yet — run 'graphify build' to generate graphify-out/graph.json");

  return {
    ...GRAPHIFY_BASE,
    detected: true,
    source: signals.join(", "),
    status: diagnostics.length === 0 ? "ok" : "warning",
    diagnostics,
  };
}
