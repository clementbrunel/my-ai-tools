import { execSync } from "node:child_process";
import chalk from "chalk";
import type { CatalogueTool, InstallStep } from "./catalogue.js";

function runStep(step: InstallStep): { ok: boolean; output: string } {
  if (!step.command) return { ok: true, output: "" };
  try {
    const output = execSync(step.command, { encoding: "utf-8", stdio: "pipe" });
    return { ok: true, output: output.trim() };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, output: msg };
  }
}

export function runInstall(tools: CatalogueTool[]): void {
  for (const tool of tools) {
    console.log(`\n${chalk.bold.cyan(`▸ ${tool.name}`)}`);
    for (const step of tool.steps) {
      if (step.command) {
        process.stdout.write(`  ${chalk.dim(step.label)} … `);
        const { ok, output } = runStep(step);
        if (ok) {
          console.log(chalk.green("ok"));
          if (output) console.log(chalk.dim(`    ${output.split("\n")[0]}`));
        } else {
          console.log(chalk.red("échec"));
          console.log(chalk.red(`    ${output.split("\n")[0]}`));
          console.log(chalk.yellow(`    Continuer manuellement : ${step.command}`));
        }
      } else {
        console.log(`  ${chalk.blue("ℹ")} ${chalk.dim(step.label)}`);
        console.log(`    ${chalk.white(step.manual!)}`);
      }
    }
  }
  console.log("");
}
