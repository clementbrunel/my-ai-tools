import { resolve } from "node:path";
import { scanMcpServers } from "./mcp.js";
import { scanContextFiles } from "./context.js";
import { scanHooks } from "./hooks.js";
import { scanModel } from "./model.js";
import { scanIntegrations } from "./integrations/index.js";
import { summarizeEnvVars } from "./env.js";
import type { ScanResult } from "../types.js";

export function runScan(projectPath: string): ScanResult {
  const absPath = resolve(projectPath);
  const model = scanModel(absPath);
  const mcpServers = scanMcpServers(absPath);
  const contextFiles = scanContextFiles(absPath);
  const hooks = scanHooks(absPath);
  const integrations = scanIntegrations(absPath, mcpServers, hooks);
  const envVarSummary = summarizeEnvVars(mcpServers);
  return { projectPath: absPath, model, mcpServers, contextFiles, hooks, integrations, envVarSummary };
}
