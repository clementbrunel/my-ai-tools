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

program.parse();
