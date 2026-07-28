import { execSync } from "node:child_process";

export function getNpmLatestVersion(pkg: string): string | null {
  try {
    return execSync(`npm view "${pkg}" version 2>/dev/null`, {
      stdio: "pipe",
      timeout: 10_000,
    })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

export function getNpmInstalledVersion(pkg: string): string | null {
  try {
    const raw = execSync(`npm list -g "${pkg}" --depth=0 --json 2>/dev/null`, {
      stdio: "pipe",
      timeout: 10_000,
    }).toString();
    const data = JSON.parse(raw) as { dependencies?: Record<string, { version: string }> };
    return data.dependencies?.[pkg]?.version ?? null;
  } catch {
    return null;
  }
}

export function updateNpmPackage(pkg: string): { success: boolean; error?: string } {
  try {
    execSync(`npm install -g "${pkg}@latest"`, { stdio: "inherit", timeout: 120_000 });
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}
