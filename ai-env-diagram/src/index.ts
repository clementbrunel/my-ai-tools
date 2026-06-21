#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { scanMcpServers } from "./scanner/mcp.js";
import { scanContextFiles } from "./scanner/context.js";
import { scanHooks } from "./scanner/hooks.js";
import { scanModel } from "./scanner/model.js";
import { scanIntegrations } from "./scanner/integrations/index.js";
import { summarizeEnvVars } from "./scanner/env.js";
import { renderConsole } from "./diagram/console.js";
import { renderMarkdown } from "./diagram/markdown.js";
import { checkAndMarkUpdates, runUpdates } from "./updater/index.js";
import { CATALOGUE, getToolById, getConflicts, suggestMissing, INTEGRATION_TO_TOOL } from "./prepare/catalogue.js";
import type { ToolId } from "./prepare/catalogue.js";
import { renderCatalogue, renderInstallPlan, renderSuggestion } from "./prepare/render.js";
import { runInstall } from "./prepare/installer.js";
import type { ScanResult } from "./types.js";


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
    const projectPath = resolve(options.path);

    console.log(chalk.blue(`\n🔍 Scanning AI environment in: ${projectPath}\n`));

    const model = scanModel(projectPath);
    const mcpServers = scanMcpServers(projectPath);
    const contextFiles = scanContextFiles(projectPath);
    const hooks = scanHooks(projectPath);
    const integrations = scanIntegrations(projectPath, mcpServers, hooks);
    const envVarSummary = summarizeEnvVars(mcpServers);

    const result: ScanResult = { projectPath, model, mcpServers, contextFiles, hooks, integrations, envVarSummary };

    process.stdout.write(renderConsole(result));

    if (options.output) {
      writeFileSync(options.output, renderMarkdown(result), "utf-8");
      console.log(chalk.green(`\n✅ Report written to: ${options.output}\n`));
    }
  });

program
  .command("update")
  .description(
    "Check for updates on all detected AI tools and apply them"
  )
  .option("-p, --path <dir>", "project directory to scan", ".")
  .action((options: { path: string }) => {
    const projectPath = resolve(options.path);

    console.log(chalk.blue(`\n🔍 Scanning AI environment in: ${projectPath}\n`));

    const model = scanModel(projectPath);
    const mcpServers = scanMcpServers(projectPath);
    const contextFiles = scanContextFiles(projectPath);
    const hooks = scanHooks(projectPath);
    const integrations = scanIntegrations(projectPath, mcpServers, hooks);
    const envVarSummary = summarizeEnvVars(mcpServers);

    const result: ScanResult = { projectPath, model, mcpServers, contextFiles, hooks, integrations, envVarSummary };

    console.log(chalk.blue("\n🔎 Checking for updates...\n"));
    const targets = checkAndMarkUpdates(result);

    process.stdout.write(renderConsole(result));

    runUpdates(targets);
  });

program
  .command("prepare")
  .description(
    "Affiche le catalogue des outils recommandés et génère un plan d'installation"
  )
  .option(
    "--with <tools>",
    "outils à installer, séparés par des virgules (ex: rtk,mempalace)",
  )
  .option("--install", "exécuter les commandes shell automatiquement")
  .option("--verbose", "afficher les descriptions complètes des outils")
  .action((options: { with?: string; install?: boolean; verbose?: boolean; path: string }) => {
    if (!options.with) {
      const projectPath = resolve(options.path);
      const mcpServers = scanMcpServers(projectPath);
      const hooks = scanHooks(projectPath);
      const integrations = scanIntegrations(projectPath, mcpServers, hooks);
      const detectedNames = integrations.filter((i) => i.detected).map((i) => i.name);
      const detectedIds = new Set(detectedNames.map((n) => INTEGRATION_TO_TOOL[n]).filter(Boolean));
      const suggested = suggestMissing(detectedNames);

      process.stdout.write(renderCatalogue(options.verbose ?? false, detectedIds));
      process.stdout.write(renderSuggestion(suggested, projectPath));
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
