import chalk from "chalk";
import type { Status } from "../types.js";
import { renderAsciiTable, consoleStatusColor, sectionHeader } from "../diagram/table.js";
import type { ToolVerification, VerifyReport, Verdict } from "./index.js";

// Verdicts reuse the scan report's status palette rather than defining a second one:
// a tool that is present but degraded is the same yellow as any other warning.
const VERDICT_STATUS: Record<Verdict, Status> = {
  ok: "ok",
  incomplete: "warning",
  missing: "error",
};

const VERDICT_LABEL: Record<Verdict, string> = {
  ok: "fonctionnel",
  incomplete: "incomplet",
  missing: "absent",
};

function verdictCell(verdict: Verdict): string {
  return consoleStatusColor(VERDICT_STATUS[verdict])(VERDICT_LABEL[verdict]);
}

/** Evidence column: what proved the tool works, or what is wrong with it. */
function evidence(result: ToolVerification): string {
  if (result.diagnostics.length > 0) return chalk.dim(result.diagnostics.join(", "));
  return result.source ? chalk.dim(result.source) : "—";
}

/** The one thing the scan report has no place for: what is left to install. */
function renderRemainingSteps(results: ToolVerification[]): string {
  const pending = results.filter((r) => r.remainingSteps.length > 0);
  if (pending.length === 0) return "";

  const lines: string[] = [sectionHeader("ÉTAPES RESTANTES"), ""];
  for (const result of pending) {
    lines.push(`  ${chalk.bold.cyan(result.name)}`);
    for (const step of result.remainingSteps) {
      const action = step.command
        ? `${chalk.white.bold("$")} ${step.command}`
        : `${chalk.blue("ℹ")} ${step.manual!}`;
      lines.push(`    ${action}  ${chalk.dim(`(${step.label})`)}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function renderSummary(report: VerifyReport): string {
  const { ok, incomplete, missing } = report.counts;
  const total = report.results.length;

  if (report.ok) {
    return chalk.green(`\n  ✓ ${total}/${total} outil(s) demandé(s) opérationnel(s) dans ce dossier.\n`);
  }

  const parts: string[] = [];
  if (incomplete > 0) parts.push(chalk.yellow(`${incomplete} incomplet(s)`));
  if (missing > 0) parts.push(chalk.red(`${missing} absent(s)`));
  const retry = report.results.filter((r) => r.verdict !== "ok").map((r) => r.id).join(",");

  return [
    `\n  ${ok}/${total} outil(s) opérationnel(s) — ${parts.join(", ")}.`,
    chalk.dim(`  Revoir les étapes : ${chalk.white(`ai-env-manager prepare --with ${retry}`)}\n`),
  ].join("\n");
}

export function renderVerify(report: VerifyReport): string {
  const parts: string[] = [];
  parts.push(sectionHeader("OUTILS DEMANDÉS") + chalk.dim(` (${report.projectPath})`));

  if (report.results.length === 0) {
    return parts.join("\n") + chalk.dim("\n  none\n");
  }

  const rows = report.results.map((r) => [r.id, r.name, verdictCell(r.verdict), evidence(r)]);
  parts.push("\n" + renderAsciiTable(["Id", "Name", "Verdict", "Evidence"], rows));
  parts.push(renderRemainingSteps(report.results));
  parts.push(renderSummary(report));

  return parts.join("\n");
}
