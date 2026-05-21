import chalk from "chalk";
import type { ScanResult } from "../types.js";
import { getNpmLatestVersion, getNpmInstalledVersion, updateNpmPackage } from "./npm.js";
import { getPipInstalledVersion, getPipLatestVersion, updatePipPackage } from "./pip.js";

export interface UpdateTarget {
  name: string;
  type: "npm" | "pip";
  pkg: string;
  installedVersion: string | null;
  latestVersion: string | null;
  outdated: boolean;
}

export function checkAndMarkUpdates(result: ScanResult): UpdateTarget[] {
  const targets: UpdateTarget[] = [];

  for (const server of result.mcpServers) {
    if (!server.npmPackage) continue;
    const pkg = server.npmPackage;
    const installed = getNpmInstalledVersion(pkg);
    const latest = getNpmLatestVersion(pkg);
    const outdated = installed !== null && latest !== null && installed !== latest;
    if (outdated) {
      server.status = "outdated";
      server.diagnostics.unshift(`Update available: ${installed} → ${latest}`);
    }
    targets.push({ name: server.name, type: "npm", pkg, installedVersion: installed, latestVersion: latest, outdated });
  }

  for (const integ of result.integrations) {
    if (!integ.detected || !integ.pipPackage) continue;
    const pkg = integ.pipPackage;
    const installed = getPipInstalledVersion(pkg);
    const latest = getPipLatestVersion(pkg);
    const outdated = installed !== null && latest !== null && installed !== latest;
    if (outdated) {
      integ.status = "outdated";
      integ.diagnostics.unshift(`Update available: ${installed} → ${latest}`);
    }
    targets.push({ name: integ.name, type: "pip", pkg, installedVersion: installed, latestVersion: latest, outdated });
  }

  return targets;
}

export function runUpdates(targets: UpdateTarget[]): void {
  const outdated = targets.filter((t) => t.outdated);

  if (outdated.length === 0) {
    console.log(chalk.green("\n✅ All tools are up to date.\n"));
    return;
  }

  console.log(chalk.blue(`\n🔄 Updating ${outdated.length} outdated tool(s)...\n`));

  for (const target of outdated) {
    console.log(
      chalk.blue(`  Updating ${target.name} (${target.installedVersion} → ${target.latestVersion})...`)
    );
    const result =
      target.type === "npm" ? updateNpmPackage(target.pkg) : updatePipPackage(target.pkg);

    if (result.success) {
      console.log(chalk.green(`  ✅ ${target.name} updated successfully`));
    } else {
      console.log(chalk.red(`  ❌ Failed to update ${target.name}: ${result.error ?? "unknown error"}`));
    }
  }

  console.log("");
}
