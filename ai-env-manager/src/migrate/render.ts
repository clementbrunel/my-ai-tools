import chalk from "chalk";
import type { Migration } from "./bundle.js";
import type { WriteResult } from "./writer.js";

const RULE = chalk.dim("─".repeat(72));

function byteLabel(content: string): string {
  const bytes = Buffer.byteLength(content, "utf-8");
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

export function renderMigrationPlan(
  migration: Migration,
  targetDir: string,
  dryRun: boolean
): string {
  const lines: string[] = [];
  const mode = dryRun ? chalk.yellow("[dry-run]") : chalk.green("[write]");

  lines.push("");
  lines.push(chalk.bold.white(`  MIGRATION CLAUDE → MISTRAL  ${mode}`));
  lines.push(RULE);
  lines.push(`  ${chalk.dim("Cible :")} ${chalk.white(targetDir)}\n`);

  lines.push(
    `  ${chalk.cyan(String(migration.stats.mcpServers))} serveur(s) MCP · ` +
      `${chalk.cyan(String(migration.stats.skills))} skill(s) · ` +
      `${chalk.cyan(String(migration.stats.contextFiles))} fichier(s) de contexte\n`
  );

  for (const file of migration.files) {
    const marker = dryRun ? chalk.yellow("⬡") : chalk.green("▶");
    lines.push(`  ${marker} ${chalk.bold(file.name.padEnd(24))} ${chalk.dim(byteLabel(file.content))}`);
  }
  lines.push("");

  if (migration.notMigrated.length > 0) {
    lines.push(chalk.bold("  NON MIGRÉ"));
    for (const item of migration.notMigrated) {
      lines.push(`  ${chalk.dim("·")} ${item.item} — ${chalk.dim(item.reason)}`);
    }
    lines.push("");
  }

  if (migration.needsReview.length > 0) {
    lines.push(chalk.bold.yellow("  À RELIRE AVANT UTILISATION"));
    for (const note of migration.needsReview) {
      lines.push(`  ${chalk.yellow("!")} ${note}`);
    }
    lines.push("");
  }

  lines.push(RULE);
  if (dryRun) {
    lines.push(
      chalk.dim(`\n  Relancer avec ${chalk.white("--write")} pour écrire les fichiers dans ${targetDir}.\n`)
    );
  }

  return lines.join("\n");
}

export function renderWriteResult(result: WriteResult): string {
  const lines: string[] = [""];

  for (const outcome of result.outcomes) {
    const label =
      outcome.action === "created"
        ? chalk.green("créé")
        : outcome.action === "updated"
          ? chalk.yellow("mis à jour")
          : chalk.dim("inchangé");
    lines.push(`  ${chalk.green("✓")} ${outcome.path} ${chalk.dim(`(${label})`)}`);
  }

  if (result.backupDir) {
    lines.push(`\n  ${chalk.blue("ℹ")} Sauvegarde des fichiers remplacés : ${result.backupDir}`);
  }

  lines.push("");
  return lines.join("\n");
}
