import { execSync } from "node:child_process";

export function getPipInstalledVersion(pkg: string): string | null {
  try {
    const output = execSync(`pip show "${pkg}" 2>/dev/null`, {
      stdio: "pipe",
      timeout: 10_000,
    }).toString();
    const match = output.match(/^Version:\s+(.+)$/m);
    return match?.[1]?.trim() ?? null;
  } catch {
    return null;
  }
}

export function getPipLatestVersion(pkg: string): string | null {
  try {
    // "pip index versions <pkg>" outputs: pkg (versions: X.Y.Z, ...)
    const output = execSync(`pip index versions "${pkg}" 2>/dev/null`, {
      stdio: "pipe",
      timeout: 10_000,
    }).toString();
    const match = output.match(/\(versions:\s*([^)]+)\)/);
    if (!match) return null;
    return match[1].split(",")[0].trim();
  } catch {
    return null;
  }
}

export function updatePipPackage(pkg: string): { success: boolean; error?: string } {
  try {
    execSync(`pip install --upgrade "${pkg}"`, { stdio: "inherit", timeout: 120_000 });
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}
