import type { McpServer, ScanResult } from "../types.js";

export function summarizeEnvVars(
  mcpServers: McpServer[]
): ScanResult["envVarSummary"] {
  const allEnvVars = mcpServers.flatMap((s) => s.envVars);

  // Deduplicate by name
  const uniqueMap = new Map(allEnvVars.map((e) => [e.name, e]));
  const unique = [...uniqueMap.values()];

  const missing = unique.filter((e) => !e.isSet);
  const set = unique.filter((e) => e.isSet);

  return {
    total: unique.length,
    set: set.length,
    missing: missing.length,
    missingList: missing.map((e) => e.name),
    setList: set.map((e) => e.name),
  };
}
