import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach } from "vitest";

/** Dossier temporaire par test, nettoye automatiquement. */
export function useTempDir(): () => Promise<string> {
  const dirs: string[] = [];
  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
  });
  return async () => {
    const dir = await mkdtemp(join(tmpdir(), "cbl-log-engine-"));
    dirs.push(dir);
    return dir;
  };
}

/** Attend qu'une condition devienne vraie (pas de sleep fixe : sonde toutes les `stepMs`). */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  what: string,
  timeoutMs = 20_000,
  stepMs = 10,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await condition()) return;
    if (Date.now() > deadline) throw new Error(`Delai depasse (${timeoutMs} ms) : ${what}`);
    await new Promise((r) => setTimeout(r, stepMs));
  }
}
