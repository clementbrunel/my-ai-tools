#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { runScan } from "./scanner/run.js";
import { renderConsole } from "./diagram/console.js";
import { renderMarkdown } from "./diagram/markdown.js";
import { checkAndMarkUpdates, runUpdates } from "./updater/index.js";
import { CATALOGUE, getToolById, getConflicts, suggestMissing, parseToolIds, INTEGRATION_TO_TOOL } from "./prepare/catalogue.js";
import type { ToolId } from "./prepare/catalogue.js";
import { renderCatalogue, renderInstallPlan, renderSuggestion } from "./prepare/render.js";
import { runInstall } from "./prepare/installer.js";
import { readRequestedTools, recordRequestedTools, STATE_FILE } from "./prepare/state.js";
import { verifyTools } from "./verify/index.js";
import { renderVerify } from "./verify/render.js";

/** Parses a --with value, exiting with the list of valid ids when something is unknown. */
function toolIdsOrExit(input: string): ToolId[] {
  const { ids, unknown } = parseToolIds(input);
  if (unknown.length > 0) {
    console.error(chalk.red(`\n  Outil(s) inconnu(s): ${unknown.join(", ")}`));
    console.error(chalk.dim(`  IDs valides : ${CATALOGUE.map((t) => t.id).join(", ")}\n`));
    process.exit(1);
  }
  return ids;
}

const program = new Command();

program
  .name("ai-env-manager")
  .description(
    "Scan, diagnose, and manage the AI environment (MCP servers, context, hooks, integrations) of a Claude Code project"
  )
  .version("0.1.0")
  .option("-p, --path <dir>", "project directory to scan", ".")
  .option("-o, --output <file>", "write markdown report to a file")
  .action((options: { path: string; output?: string }) => {
    const result = runScan(options.path);

    console.log(chalk.blue(`\n🔍 Scanning AI environment in: ${result.projectPath}\n`));
    process.stdout.write(renderConsole(result));

    if (options.output) {
      writeFileSync(options.output, renderMarkdown(result), "utf-8");
      console.log(chalk.green(`\n✅ Report written to: ${options.output}\n`));
    }
  });

program
  .command("update")
  .description("Check for updates on all detected AI tools and apply them")
  .option("-p, --path <dir>", "project directory to scan", ".")
  .action((options: { path: string }) => {
    const result = runScan(options.path);

    console.log(chalk.blue(`\n🔍 Scanning AI environment in: ${result.projectPath}\n`));
    console.log(chalk.blue("\n🔎 Checking for updates...\n"));
    const targets = checkAndMarkUpdates(result);

    process.stdout.write(renderConsole(result));
    runUpdates(targets);
  });

program
  .command("prepare")
  .description("Affiche le catalogue des outils recommandés et génère un plan d'installation")
  .option("-p, --path <dir>", "project directory to scan", ".")
  .option("--with <tools>", "outils à installer, séparés par des virgules (ex: rtk,mempalace)")
  .option("--install", "exécuter les commandes shell automatiquement")
  .option("--verbose", "afficher les descriptions complètes des outils")
  .option("--no-record", `ne pas enregistrer les outils demandés dans ${STATE_FILE}`)
  .action((options: { path: string; with?: string; install?: boolean; verbose?: boolean; record: boolean }) => {
    if (!options.with) {
      const result = runScan(options.path);
      const detectedNames = result.integrations.filter((i) => i.detected).map((i) => i.name);
      const detectedIds = new Set(detectedNames.map((n) => INTEGRATION_TO_TOOL[n]).filter(Boolean));
      const suggested = suggestMissing(detectedNames);

      process.stdout.write(renderCatalogue(options.verbose ?? false, detectedIds));
      process.stdout.write(renderSuggestion(suggested, result.projectPath));
      return;
    }

    const ids = toolIdsOrExit(options.with);
    const tools = ids.map((id) => getToolById(id)!);
    const conflicts = getConflicts(ids);

    process.stdout.write(renderInstallPlan(tools, conflicts, !options.install));

    if (conflicts.length === 0 && options.record) {
      const statePath = recordRequestedTools(options.path, ids);
      console.log(chalk.dim(`  Outils demandés enregistrés dans ${statePath}`));
      console.log(chalk.dim(`  Contrôle a posteriori : ${chalk.white("ai-env-manager verify")}\n`));
    }

    if (options.install && conflicts.length === 0) {
      runInstall(tools);
    }
  });

program
  .command("verify")
  .description("Vérifie que les outils demandés sont bien installés et fonctionnels dans le dossier cible")
  .option("-p, --path <dir>", "project directory to scan", ".")
  .option("--with <tools>", `outils à vérifier (défaut : ceux enregistrés dans ${STATE_FILE})`)
  .option("--json", "sortie JSON, pour une utilisation en CI")
  .action((options: { path: string; with?: string; json?: boolean }) => {
    const ids = options.with ? toolIdsOrExit(options.with) : readRequestedTools(options.path);

    if (ids.length === 0) {
      console.error(chalk.red(`\n  Aucun outil à vérifier : ni --with, ni ${STATE_FILE} dans ${resolve(options.path)}.`));
      console.error(chalk.dim(`  Lancer ${chalk.white("ai-env-manager prepare --with <tool1,tool2>")} d'abord, ou passer --with.\n`));
      process.exit(1);
    }

    const report = verifyTools(runScan(options.path), ids);

    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      process.stdout.write(renderVerify(report));
    }

    if (!report.ok) process.exit(1);
  });

program.parse();
