import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { homedir } from "node:os";

export function parseJsonFile<T>(filePath: string): T | null {
  try {
    if (!existsSync(filePath)) return null;
    const content = readFileSync(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

export function isCommandAvailable(command: string): boolean {
  try {
    execSync(`which ${command} 2>/dev/null || where ${command} 2>/dev/null`, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

export function isApiKeyPattern(name: string): boolean {
  const upper = name.toUpperCase();
  return (
    upper.endsWith("_API_KEY") ||
    upper.endsWith("_TOKEN") ||
    upper.endsWith("_SECRET") ||
    upper.endsWith("_KEY") ||
    upper.endsWith("_PASSWORD") ||
    upper.includes("API_KEY") ||
    upper.includes("AUTH")
  );
}

export function detectPlugin(
  namePattern: RegExp,
  marketplaceDirName: string
): { detected: boolean; source?: string } {
  const settingsPath = join(homedir(), ".claude", "settings.json");
  const settings = parseJsonFile<{ enabledPlugins?: Record<string, boolean> }>(settingsPath);
  if (!settings) return { detected: false };
  const enabled = settings.enabledPlugins ?? {};
  const pluginKey = Object.keys(enabled).find((k) => namePattern.test(k));
  if (pluginKey && enabled[pluginKey]) {
    const marketplaceDir = join(homedir(), ".claude", "plugins", "marketplaces", marketplaceDirName);
    return { detected: true, source: existsSync(marketplaceDir) ? marketplaceDir : pluginKey };
  }
  return { detected: false };
}
