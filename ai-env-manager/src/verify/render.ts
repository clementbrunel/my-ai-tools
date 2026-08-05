import chalk from "chalk";
import { CATALOGUE } from "../prepare/catalogue.js";
import type { ToolVerification, VerifyReport, Verdict } from "./index.js";

const RULE = chalk.dim("─".repeat(72));
const ID_WIDTH = Math.max(...CATALOGUE.map((t) => t.id.length));
const NAME_WIDTH = Math.max(...CATALOGUE.map((t) => t.name.length));

const BADGES: Record<Verdict, string> = {
  ok: chalk.green("fonctionnel"),
  incomplete: chalk.yellow("incomplet"),
  missing: chalk.red("absent"),
};

const MARKS: Record<Verdict, string> = {
  ok: chalk.green("✓"),
  incomplete: chalk.yellow("⚠"),
  missing: chalk.red("✗"),
};

function renderResult(result: ToolVerification): string {
  const lines: string[] = [];
  const id = chalk.bold.cyan(result.id.padEnd(ID_WIDTH));
  const indent = " ".repeat(ID_WIDTH + 6);

  lines.push(
    `  ${MARKS[result.verdict]} ${id}  ${chalk.white(result.name.padEnd(NAME_WIDTH))}  ${BADGES[result.verdict]}`
  );

  if (result.source) {
    lines.push(`${indent}${chalk.dim(`source : ${result.source}`)}`);
  }
  for (const diagnostic of result.diagnostics) {
    lines.push(`${indent}${chalk.yellow("•")} ${diagnostic}`);
  }
  if (result.remainingSteps.length > 0) {
    lines.push(`${indent}${chalk.dim("Étapes restantes :")}`);
    for (const step of result.remainingSteps) {
      const action = step.command
        ? `${chalk.white.bold("$")} ${step.command}`
        : `${chalk.blue("ℹ")} ${step.manual!}`;
      lines.push(`${indent}  ${action}  ${chalk.dim(`(${step.label})`)}`);
    }
  }

  return lines.join("\n");
}

function renderSummary(report: VerifyReport): string {
  const { ok, incomplete, missing } = report.counts;
  const total = report.results.length;

  if (report.ok) {
    return chalk.green.bold(`\n  ✓ ${total}/${total} outil(s) demandé(s) opérationnel(s) dans ce dossier.\n`);
  }

  const parts: string[] = [];
  if (incomplete > 0) parts.push(chalk.yellow(`${incomplete} incomplet(s)`));
  if (missing > 0) parts.push(chalk.red(`${missing} absent(s)`));

  return [
    chalk.bold(`\n  ${ok}/${total} outil(s) opérationnel(s) — ${parts.join(", ")}.`),
    chalk.dim(`  Relancer les étapes avec ${chalk.white(`ai-env-manager prepare --with ${report.results.filter((r) => r.verdict !== "ok").map((r) => r.id).join(",")}`)}\n`),
  ].join("\n");
}

export function renderVerify(report: VerifyReport): string {
  const lines: string[] = [];
  lines.push("");
  lines.push(chalk.bold.white("VÉRIFICATION — outils demandés"));
  lines.push(chalk.dim(`Dossier : ${report.projectPath}`));
  lines.push(RULE);
  lines.push("");

  if (report.results.length === 0) {
    lines.push(chalk.dim("  Aucun outil à vérifier.\n"));
    return lines.join("\n");
  }

  for (const result of report.results) {
    lines.push(renderResult(result));
    lines.push("");
  }

  lines.push(RULE);
  lines.push(renderSummary(report));

  return lines.join("\n");
}
