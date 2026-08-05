import type { Integration, ScanResult } from "../types.js";
import { getToolById, TOOL_TO_INTEGRATION } from "../prepare/catalogue.js";
import type { InstallStep, ToolId } from "../prepare/catalogue.js";

/**
 * ok         — detected in the target folder and reporting no problem
 * incomplete — detected but the integration is broken or half-configured
 * missing    — no trace of the tool in the target folder
 */
export type Verdict = "ok" | "incomplete" | "missing";

export interface ToolVerification {
  id: ToolId;
  name: string;
  verdict: Verdict;
  source?: string;
  diagnostics: string[];
  /** Install steps to run — only filled when nothing was detected at all. */
  remainingSteps: InstallStep[];
}

export interface VerifyReport {
  projectPath: string;
  results: ToolVerification[];
  ok: boolean;
  counts: Record<Verdict, number>;
}

function verdictFor(integration: Integration | undefined): Verdict {
  if (!integration?.detected) return "missing";
  return integration.status === "ok" ? "ok" : "incomplete";
}

function verifyTool(id: ToolId, integrations: Integration[]): ToolVerification {
  const tool = getToolById(id)!;
  const integrationName = TOOL_TO_INTEGRATION[id];
  const integration = integrations.find((i) => i.name === integrationName);
  const verdict = verdictFor(integration);

  const diagnostics = integration
    ? [...integration.diagnostics]
    : [`Aucun détecteur disponible pour « ${id} » — vérification impossible`];

  return {
    id,
    name: tool.name,
    verdict,
    source: verdict === "missing" ? undefined : integration?.source,
    diagnostics,
    remainingSteps: verdict === "missing" ? tool.steps : [],
  };
}

/** Checks that every requested tool is actually usable in the scanned folder. */
export function verifyTools(scan: ScanResult, ids: ToolId[]): VerifyReport {
  const results = ids.map((id) => verifyTool(id, scan.integrations));
  const counts: Record<Verdict, number> = { ok: 0, incomplete: 0, missing: 0 };
  for (const r of results) counts[r.verdict] += 1;

  return {
    projectPath: scan.projectPath,
    results,
    ok: results.every((r) => r.verdict === "ok"),
    counts,
  };
}
