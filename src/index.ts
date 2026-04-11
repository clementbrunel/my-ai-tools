#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { scanMcpServers } from "./scanner/mcp.js";
import { scanContextFiles } from "./scanner/context.js";
import { scanHooks } from "./scanner/hooks.js";
import { scanModel } from "./scanner/model.js";
import { scanIntegrations } from "./scanner/integrations.js";
import { summarizeEnvVars } from "./scanner/env.js";
import { generateMermaid, generateSummary } from "./diagram/mermaid.js";
import type { ScanResult } from "./types.js";

const program = new Command();

program
  .name("ai-env-diagram")
  .description(
    "Scan and visualize the AI environment (MCP servers, context, hooks) of a Claude Code project"
  )
  .version("0.1.0")
  .option("-p, --path <dir>", "project directory to scan", ".")
  .option("-o, --output <file>", "write diagram to a file instead of stdout")
  .option(
    "--summary",
    "include a summary table with errors and warnings",
    false
  )
  .action((options: { path: string; output?: string; summary: boolean }) => {
    const projectPath = resolve(options.path);

    console.log(
      chalk.blue(`\n🔍 Scanning AI environment in: ${projectPath}\n`)
    );

    // Run all scanners
    const model = scanModel(projectPath);
    const mcpServers = scanMcpServers(projectPath);
    const contextFiles = scanContextFiles(projectPath);
    const hooks = scanHooks(projectPath);
    const integrations = scanIntegrations(projectPath, mcpServers, hooks);
    const envVarSummary = summarizeEnvVars(mcpServers);

    const result: ScanResult = {
      projectPath,
      model,
      mcpServers,
      contextFiles,
      hooks,
      integrations,
      envVarSummary,
    };

    // Print scan stats
    const modelLabel = model.configured ?? "default (unset)";
    const modelColor =
      model.status === "ok"
        ? chalk.green
        : model.status === "warning"
          ? chalk.yellow
          : chalk.red;
    console.log(modelColor(`  Model:         ${modelLabel}`));
    console.log(chalk.gray(`  MCP Servers:   ${mcpServers.length} found`));

    const totalTokens = contextFiles.reduce(
      (sum, f) => sum + f.estimatedTokens,
      0
    );
    let worstCtxStatus: "ok" | "warning" | "error" = "ok";
    if (contextFiles.some((f) => f.status === "error")) worstCtxStatus = "error";
    else if (contextFiles.some((f) => f.status === "warning")) worstCtxStatus = "warning";

    let ctxColor = chalk.gray;
    if (worstCtxStatus === "error") ctxColor = chalk.red;
    else if (worstCtxStatus === "warning") ctxColor = chalk.yellow;
    console.log(
      ctxColor(
        `  Context Files: ${contextFiles.length} found (~${totalTokens.toLocaleString()} tokens)`
      )
    );
    console.log(chalk.gray(`  Hooks:         ${hooks.length} found`));
    console.log(
      chalk.gray(
        `  Integrations:  ${integrations.filter((i) => i.detected).length}/${integrations.length} detected`
      )
    );
    for (const integ of integrations) {
      const icon =
        integ.status === "ok" ? "✅" : integ.status === "warning" ? "⚠️" : "❌";
      const color =
        integ.status === "ok"
          ? chalk.green
          : integ.status === "warning"
            ? chalk.yellow
            : chalk.red;
      console.log(color(`     ${icon} ${integ.name}`));
    }
    console.log(
      chalk.gray(
        `  Env Vars:      ${envVarSummary.set}/${envVarSummary.total} set`
      )
    );

    // Report errors
    const errors = [
      ...mcpServers.filter((s) => s.status === "error"),
      ...hooks.filter((h) => h.status === "error"),
    ];
    if (errors.length > 0) {
      console.log(chalk.red(`\n  ❌ ${errors.length} error(s) detected:`));
      for (const err of errors) {
        const name = "name" in err ? err.name : err.event;
        console.log(chalk.red(`     - ${name}: ${err.diagnostics[0]}`));
      }
    }

    const warnings = [
      ...mcpServers.filter((s) => s.status === "warning"),
      ...hooks.filter((h) => h.status === "warning"),
    ];
    if (warnings.length > 0) {
      console.log(
        chalk.yellow(`\n  ⚠️  ${warnings.length} warning(s):`)
      );
      for (const warn of warnings) {
        const name = "name" in warn ? warn.name : warn.event;
        console.log(
          chalk.yellow(`     - ${name}: ${warn.diagnostics[0]}`)
        );
      }
    }

    // Generate output
    let output = generateMermaid(result);
    if (options.summary) {
      output = generateSummary(result) + "\n" + output;
    }

    if (options.output) {
      writeFileSync(options.output, output, "utf-8");
      console.log(
        chalk.green(`\n✅ Diagram written to: ${options.output}\n`)
      );
    } else {
      console.log(chalk.blue("\n--- Mermaid Diagram ---\n"));
      console.log(output);
      console.log("");
    }
  });

program.parse();
