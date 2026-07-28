#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { runScan } from "./scanner/run.js";
import { renderConsole } from "./diagram/console.js";
import { renderMarkdown } from "./diagram/markdown.js";
import { checkAndMarkUpdates, runUpdates } from "./updater/index.js";
import { CATALOGUE, getToolById, getConflicts, suggestMissing, INTEGRATION_TO_TOOL } from "./prepare/catalogue.js";
import type { ToolId } from "./prepare/catalogue.js";
import { renderCatalogue, renderInstallPlan, renderSuggestion } from "./prepare/render.js";
import { runInstall } from "./prepare/installer.js";

const program = new Command();

program
  .name("ai-env-diagram")
  .description(
    "Scan and visualize the AI environment (MCP servers, context, hooks) of a Claude Code project"
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
  .action((options: { path: string; with?: string; install?: boolean; verbose?: boolean }) => {
    if (!options.with) {
      const result = runScan(options.path);
      const detectedNames = result.integrations.filter((i) => i.detected).map((i) => i.name);
      const detectedIds = new Set(detectedNames.map((n) => INTEGRATION_TO_TOOL[n]).filter(Boolean));
      const suggested = suggestMissing(detectedNames);

      process.stdout.write(renderCatalogue(options.verbose ?? false, detectedIds));
      process.stdout.write(renderSuggestion(suggested, result.projectPath));
      return;
    }

    const ids = options.with.split(",").map((s) => s.trim()) as ToolId[];
    const validIds = new Set(CATALOGUE.map((t) => t.id));
    const unknown = ids.filter((id) => !validIds.has(id));
    if (unknown.length > 0) {
      console.error(chalk.red(`\n  Outil(s) inconnu(s): ${unknown.join(", ")}`));
      console.error(chalk.dim(`  IDs valides : ${[...validIds].join(", ")}\n`));
      process.exit(1);
    }

    const tools = ids.map((id) => getToolById(id)!);
    const conflicts = getConflicts(ids);

    process.stdout.write(renderInstallPlan(tools, conflicts, !options.install));

    if (options.install && conflicts.length === 0) {
      runInstall(tools);
    }
  });

program.parse();
