// Sanity de debit, hors CI : CBL_PERF=1 npm test -w @cbl-log/engine -- perf
import { closeSync, mkdtempSync, openSync, rmSync, writeSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FileSource, indexInWorker, LineIndex } from "../src/index";

const SIZE_MB = Number(process.env.CBL_PERF_MB ?? 200);

describe.skipIf(!process.env.CBL_PERF)("debit d'indexation", () => {
  it(`indexe ~${SIZE_MB} Mo`, { timeout: 120_000 }, async () => {
    const dir = mkdtempSync(join(tmpdir(), "cbl-log-perf-"));
    const path = join(dir, "big.log");
    try {
      const block = Buffer.from(
        Array.from({ length: 8000 }, (_, i) => `[10/14/26 10:02:11:204 CEST] 0000004a SystemOut     O Message de test numero ${i} avec un peu de contenu\r\n`).join(""),
      );
      const fd = openSync(path, "w");
      let written = 0;
      while (written < SIZE_MB * 1024 * 1024) written += writeSync(fd, block);
      closeSync(fd);
      const mb = written / 1024 / 1024;

      const source = await FileSource.open(path);
      const local = new LineIndex(source, "utf-8");
      let t0 = performance.now();
      await local.appendFrom();
      const localSec = (performance.now() - t0) / 1000;

      t0 = performance.now();
      await indexInWorker(path, "utf-8");
      const workerSec = (performance.now() - t0) / 1000;

      console.log(
        `[perf] ${mb.toFixed(0)} Mo, ${local.lineCount} lignes : en processus ${(mb / localSec).toFixed(0)} Mo/s, worker ${(mb / workerSec).toFixed(0)} Mo/s`,
      );
      expect(local.lineCount).toBeGreaterThan(0);
      await source.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
