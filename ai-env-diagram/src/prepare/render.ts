import chalk from "chalk";
import type { CatalogueTool, ConflictGroup } from "./catalogue.js";
import { CATALOGUE, CONFLICT_GROUPS } from "./catalogue.js";

const RULE = chalk.dim("─".repeat(72));

function groupedCatalogue(): Map<string | undefined, CatalogueTool[]> {
  const groups = new Map<string | undefined, CatalogueTool[]>();
  for (const tool of CATALOGUE) {
    const key = tool.conflictGroup;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(tool);
  }
  return groups;
}

function renderToolEntry(tool: CatalogueTool, verbose: boolean): string {
  const lines: string[] = [];
  lines.push(`  ${chalk.bold.cyan(tool.id.padEnd(14))} ${chalk.white(tool.name)}`);
  lines.push(`  ${" ".repeat(14)} ${chalk.dim(tool.tagline)}`);
  if (verbose) {
    lines.push(`  ${" ".repeat(14)} ${tool.why}`);
  }
  return lines.join("\n");
}

function renderGroupHeader(group: ConflictGroup): string {
  const maxLabel = group.maxPick === 1 ? chalk.yellow("choisir 1") : chalk.yellow(`choisir ${group.maxPick} max`);
  return `\n  ${chalk.bold(group.label.toUpperCase())}  ${chalk.dim(`(${maxLabel})`)}\n  ${chalk.dim(group.note)}\n`;
}

export function renderCatalogue(verbose = false): string {
  const lines: string[] = [];
  lines.push("");
  lines.push(chalk.bold.white("CATALOGUE — outils recommandés pour l'environnement IA"));
  lines.push(RULE);

  const groups = groupedCatalogue();

  for (const cg of CONFLICT_GROUPS) {
    const tools = groups.get(cg.id) ?? [];
    if (tools.length === 0) continue;
    lines.push(renderGroupHeader(cg));
    for (const tool of tools) {
      lines.push(renderToolEntry(tool, verbose));
      lines.push("");
    }
  }

  // standalone tools (no conflict group)
  const standalone = groups.get(undefined) ?? [];
  if (standalone.length > 0) {
    lines.push(`\n  ${chalk.bold("FRAMEWORK TOUT-EN-UN")}\n  ${chalk.dim("Remplace les outils individuels — ne pas combiner avec caveman.")}\n`);
    for (const tool of standalone) {
      lines.push(renderToolEntry(tool, verbose));
      lines.push("");
    }
  }

  lines.push(RULE);
  lines.push(chalk.bold("\n  UTILISATION"));
  lines.push(chalk.dim("  Choisir les outils et générer les étapes d'installation :\n"));
  lines.push(`    ${chalk.cyan("ai-env-diagram prepare --with rtk,mempalace")}`);
  lines.push(`    ${chalk.cyan("ai-env-diagram prepare --with headroom,socraticode")}`);
  lines.push(`    ${chalk.cyan("ai-env-diagram prepare --with ecc,socraticode")}`);
  lines.push("");
  lines.push(chalk.dim("  Ajouter --install pour exécuter automatiquement les commandes shell."));
  lines.push(chalk.dim("  Ajouter --verbose pour afficher les descriptions complètes.\n"));

  return lines.join("\n");
}

export function renderInstallPlan(
  tools: CatalogueTool[],
  conflicts: { group: ConflictGroup; picks: string[] }[],
  dryRun: boolean
): string {
  const lines: string[] = [];
  lines.push("");

  if (conflicts.length > 0) {
    lines.push(chalk.bold.red("  CONFLITS DÉTECTÉS — corriger avant de continuer\n"));
    for (const { group, picks } of conflicts) {
      lines.push(`  ${chalk.red("✗")} ${chalk.bold(group.label)}: ${picks.join(", ")} — ${group.note}`);
    }
    lines.push("");
    return lines.join("\n");
  }

  const mode = dryRun ? chalk.yellow("[dry-run]") : chalk.green("[install]");
  lines.push(chalk.bold.white(`  PLAN D'INSTALLATION  ${mode}`));
  lines.push(RULE);

  for (const tool of tools) {
    lines.push(`\n  ${chalk.bold.cyan(tool.name)}`);
    lines.push(`  ${chalk.dim(tool.tagline)}\n`);

    for (const step of tool.steps) {
      if (step.command) {
        const prefix = dryRun ? chalk.yellow("  ⬡") : chalk.green("  ▶");
        lines.push(`${prefix} ${chalk.dim(step.label)}`);
        lines.push(`    ${chalk.white.bold("$")} ${step.command}`);
      } else {
        lines.push(`  ${chalk.blue("  ℹ")} ${chalk.dim(step.label)}`);
        lines.push(`    ${chalk.white(step.manual!)}`);
      }
      lines.push("");
    }
  }

  lines.push(RULE);

  const hasManual = tools.some((t) => t.steps.some((s) => s.manual && !s.command));
  const hasAuto = tools.some((t) => t.steps.some((s) => s.command));

  if (dryRun && hasAuto) {
    lines.push(chalk.dim(`\n  Relancer avec ${chalk.white("--install")} pour exécuter les commandes shell (${chalk.green("▶")}).\n`));
  }
  if (hasManual) {
    lines.push(chalk.dim(`  Les étapes (${chalk.blue("ℹ")}) nécessitent une action manuelle dans Claude Code ou le terminal.\n`));
  }

  return lines.join("\n");
}

export function renderSuggestion(suggested: string[], projectPath: string): string {
  const lines: string[] = [];
  lines.push("");
  lines.push(RULE);

  if (suggested.length === 0) {
    lines.push(chalk.green("\n  ✓ Tous les groupes d'outils sont déjà couverts dans cet environnement.\n"));
    return lines.join("\n");
  }

  const withArg = suggested.join(",");
  lines.push(chalk.bold("\n  SUGGESTION — basée sur le scan de votre environnement"));
  lines.push(chalk.dim(`  Projet : ${projectPath}\n`));
  lines.push(chalk.dim("  Outils manquants détectés. Commande générée :\n"));
  lines.push(`    ${chalk.cyan.bold(`ai-env-diagram prepare --with ${withArg}`)}`);
  lines.push("");
  lines.push(`    ${chalk.dim("Ajouter")} ${chalk.white("--install")} ${chalk.dim("pour exécuter les étapes shell automatiquement.")}`);
  lines.push(`    ${chalk.dim("Modifier")} ${chalk.white(`--with ${withArg}`)} ${chalk.dim("selon vos préférences (voir catalogue ci-dessus).")}\n`);

  return lines.join("\n");
}
