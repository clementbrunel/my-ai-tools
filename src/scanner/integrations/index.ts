import { resolve } from "node:path";
import type { Integration, McpServer, Hook } from "../../types.js";
import { detectMemPalace } from "./mempalace.js";
import { detectCaveman } from "./caveman.js";
import { detectRtk } from "./rtk.js";

export function scanIntegrations(
  projectPath: string,
  mcpServers: McpServer[],
  hooks: Hook[]
): Integration[] {
  const absPath = resolve(projectPath);
  return [
    detectMemPalace(mcpServers, absPath),
    detectCaveman(absPath),
    detectRtk(absPath, hooks),
  ];
}
