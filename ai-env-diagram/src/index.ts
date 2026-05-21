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
import { generateMermaid, generateSummary } from "./diagram/mermaid.js";
import { checkAndMarkUpdates, runUpdates } from "./updater/index.js";
import type { ScanResult, Status } from "./types.js";
import { getComponentName } from "./types.js";

type ChalkColor = typeof chalk.green;

function statusChalkColor(status: Status): ChalkColor {
  if (status === "ok") return chalk.green;
  if (status === "warning") return chalk.yellow;
  if (status === "outdated") return chalk.blue;
  return chalk.red;
}

function statusIcon(status: Status): string {
  if (status === "ok") return "✅";
  if (status === "warning") return "⚠️";
  if (status === "outdated") return "🔄";
  return "❌";
}

function printScanStats(result: ScanResult): void {
  const { model, mcpServers, contextFiles, hooks, integrations, envVarSummary } = result;

  const modelLabel = model.configured ?? "default (unset)";
  console.log(statusChalkColor(model.status)(`  Model:         ${modelLabel}`));
  console.log(chalk.gray(`  MCP Servers:   ${mcpServers.length} found`));

  const totalTokens = contextFiles.reduce((sum, f) => sum + f.estimatedTokens, 0);
  let worstCtxStatus: Status = "ok";
  if (contextFiles.some((f) => f.status === "error")) worstCtxStatus = "error";
  else if (contextFiles.some((f) => f.status === "warning")) worstCtxStatus = "warning";
  console.log(
    statusChalkColor(worstCtxStatus)(
      `  Context Files: ${contextFiles.length} found (~${totalTokens.toLocaleString()} tokens)`
    )
  );

  console.log(chalk.gray(`  Hooks:         ${hooks.length} found`));
  console.log(
    chalk.gray(`  Integrations:  ${integrations.filter((i) => i.detected).length}/${integrations.length} detected`)
  );
  for (const integ of integrations) {
    const detailSuffix = integ.detail ? chalk.dim(` [${integ.detail}]`) : "";
    console.log(statusChalkColor(integ.status)(`     ${statusIcon(integ.status)} ${integ.name}`) + detailSuffix);
  }
  console.log(chalk.gray(`  Env Vars:      ${envVarSummary.set}/${envVarSummary.total} set`));
}

function printDiagnostics(result: ScanResult): void {
  const { mcpServers, hooks, integrations } = result;

  const errors = [
    ...mcpServers.filter((s) => s.status === "error"),
    ...hooks.filter((h) => h.status === "error"),
  ];
  if (errors.length > 0) {
    console.log(chalk.red(`\n  ❌ ${errors.length} error(s) detected:`));
    for (const err of errors) {
      console.log(chalk.red(`     - ${getComponentName(err)}: ${err.diagnostics[0]}`));
    }
  }

  const warnings = [
    ...mcpServers.filter((s) => s.status === "warning"),
    ...hooks.filter((h) => h.status === "warning"),
  ];
  if (warnings.length > 0) {
    console.log(chalk.yellow(`\n  ⚠️  ${warnings.length} warning(s):`));
    for (const warn of warnings) {
      console.log(chalk.yellow(`     - ${getComponentName(warn)}: ${warn.diagnostics[0]}`));
    }
  }

  const outdatedItems = [
    ...mcpServers.filter((s) => s.status === "outdated"),
    ...integrations.filter((i) => i.status === "outdated"),
  ];
  if (outdatedItems.length > 0) {
    console.log(chalk.blue(`\n  🔄 ${outdatedItems.length} outdated tool(s):`));
    for (const item of outdatedItems) {
      console.log(chalk.blue(`     - ${getComponentName(item)}: ${item.diagnostics[0]}`));
    }
  }
}

const program = new Command();

program
  .name("ai-env-diagram")
  .description(
    "Scan and visualize the AI environment (MCP servers, context, hooks) of a Claude Code project"
  )
  .version("0.1.0")
  .option("-p, --path <dir>", "project directory to scan", ".")
  .option("-o, --output <file>", "write diagram to a file instead of stdout")
  .option("--summary", "include a summary table with errors and warnings", false)
  .action((options: { path: string; output?: string; summary: boolean }) => {
    const projectPath = resolve(options.path);

    console.log(chalk.blue(`\n🔍 Scanning AI environment in: ${projectPath}\n`));

    const model = scanModel(projectPath);
    const mcpServers = scanMcpServers(projectPath);
    const contextFiles = scanContextFiles(projectPath);
    const hooks = scanHooks(projectPath);
    const integrations = scanIntegrations(projectPath, mcpServers, hooks);
    const envVarSummary = summarizeEnvVars(mcpServers);

    const result: ScanResult = { projectPath, model, mcpServers, contextFiles, hooks, integrations, envVarSummary };

    printScanStats(result);
    printDiagnostics(result);

    let output = generateMermaid(result);
    if (options.summary) {
      output = generateSummary(result) + "\n" + output;
    }

    if (options.output) {
      writeFileSync(options.output, output, "utf-8");
      console.log(chalk.green(`\n✅ Diagram written to: ${options.output}\n`));
    } else {
      console.log(chalk.blue("\n--- Mermaid Diagram ---\n"));
      console.log(output);
      console.log("");
    }
  });

program
  .command("update")
  .description(
    "Check for updates on all detected AI tools and apply them"
  )
  .option("-p, --path <dir>", "project directory to scan", ".")
  .option("--summary", "include a summary table in the diagram", false)
  .action((options: { path: string; summary: boolean }) => {
    const projectPath = resolve(options.path);

    console.log(chalk.blue(`\n🔍 Scanning AI environment in: ${projectPath}\n`));

    const model = scanModel(projectPath);
    const mcpServers = scanMcpServers(projectPath);
    const contextFiles = scanContextFiles(projectPath);
    const hooks = scanHooks(projectPath);
    const integrations = scanIntegrations(projectPath, mcpServers, hooks);
    const envVarSummary = summarizeEnvVars(mcpServers);

    const result: ScanResult = { projectPath, model, mcpServers, contextFiles, hooks, integrations, envVarSummary };

    printScanStats(result);

    console.log(chalk.blue("\n🔎 Checking for updates...\n"));
    const targets = checkAndMarkUpdates(result);

    printDiagnostics(result);

    let output = generateMermaid(result);
    if (options.summary) {
      output = generateSummary(result) + "\n" + output;
    }
    console.log(chalk.blue("\n--- Mermaid Diagram ---\n"));
    console.log(output);
    console.log("");

    runUpdates(targets);
  });

program.parse();
