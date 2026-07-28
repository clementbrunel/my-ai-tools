import { execSync } from "node:child_process";
import type { Integration, McpServer, Status } from "../../types.js";
import { isCommandAvailable, detectPlugin } from "../../utils.js";

function isMemPalaceAvailable(): boolean {
  if (isCommandAvailable("mempalace")) return true;
  try {
    execSync("python -m mempalace --help", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function getMemPalaceWingStats(projectPath: string): string | null {
  // Wing name = last path segment, lowercase, hyphens→underscores
  const wingName = projectPath.split(/[/\\]/).findLast(Boolean)?.toLowerCase().replaceAll("-", "_") ?? "";
  try {
    const output = execSync("python -m mempalace status", { stdio: "pipe", encoding: "utf-8" });
    const normalized = output.replaceAll("\r\n", "\n");
    const wingMatch = new RegExp(String.raw`WING:\s+${wingName}\s*\n((?:\s+ROOM:.*\n)*)`, "i");
    const match = normalized.match(wingMatch);
    if (!match) return null;
    const roomLines = match[1].trim().split("\n").filter(Boolean);
    let total = 0;
    const rooms: string[] = [];
    for (const line of roomLines) {
      const m = line.match(/ROOM:\s+(\S+)\s+(\d+)\s+drawers?/i);
      if (m) {
        total += Number.parseInt(m[2], 10);
        rooms.push(`${m[1]}:${m[2]}`);
      }
    }
    return `${total} drawers (${rooms.join(", ")})`;
  } catch {
    return null;
  }
}

const MEMPALACE_BASE = {
  name: "MemPalace",
  description: "Long-term memory MCP server",
  pipPackage: "mempalace",
} as const;

export function detectMemPalace(mcpServers: McpServer[], projectPath: string): Integration {
  const diagnostics: string[] = [];
  const isMemPalaceServer = (s: McpServer) =>
    /mem.?palace/i.test(s.name) ||
    (s.command ? /mem.?palace/i.test(s.command) : false) ||
    (s.args?.some((a) => /mem.?palace/i.test(a)) ?? false);

  const match = mcpServers.find(isMemPalaceServer);
  const wingStats = getMemPalaceWingStats(projectPath) ?? undefined;

  if (!match) {
    const pluginResult = detectPlugin(/mem.?palace/i, "mempalace");
    if (pluginResult.detected) {
      const commandOk = isMemPalaceAvailable();
      if (!commandOk) diagnostics.push("'mempalace' binary not found in PATH");
      return { ...MEMPALACE_BASE, detected: true, source: `plugin: ${pluginResult.source}`, status: commandOk ? "ok" : "warning", diagnostics, detail: wingStats };
    }
    return { ...MEMPALACE_BASE, detected: false, status: "warning", diagnostics: ["Not configured as an MCP server or plugin in this project"] };
  }

  const commandOk = isMemPalaceAvailable();
  let status: Status = match.status;
  if (!commandOk) { diagnostics.push("'mempalace' binary not found in PATH"); status = "error"; }
  if (match.status !== "ok") diagnostics.push(...match.diagnostics);

  return { ...MEMPALACE_BASE, detected: true, source: match.source, status, diagnostics, detail: wingStats };
}
