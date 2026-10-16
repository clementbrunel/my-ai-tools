import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BlockCache, FileSource, indexInWorker, LineIndex, type Encoding, type IndexProgress } from "../src/index";
import { generateFile, mulberry32 } from "./gen";
import { useTempDir } from "./helpers";

// Le worker est du JS compile : `npm test` du moteur lance d'abord `tsc` (voir package.json).
const tempDir = useTempDir();

async function fileWith(data: Buffer | string): Promise<string> {
  const path = join(await tempDir(), "w.log");
  writeFileSync(path, data);
  return path;
}

describe("indexInWorker", () => {
  it("donne le meme resultat que l'indexation en processus", async () => {
    for (const enc of ["utf-8", "utf-16le", "utf-16be"] as const satisfies readonly Encoding[]) {
      const gen = generateFile(mulberry32(99), enc, { maxLines: 5000, maxLen: 150 });
      const path = await fileWith(gen.data);
      const source = await FileSource.open(path, { cache: new BlockCache() });
      const local = new LineIndex(source, enc);
      await local.appendFrom();

      const result = await indexInWorker(path, enc, { chunkSize: 4096 });
      expect(result.state).not.toBeNull();
      expect(result.state!.terminators + (result.state!.scanned > result.state!.lineStart ? 1 : 0)).toBe(local.lineCount);
      expect(result.state!.scanned).toBe(local.scannedBytes);
      expect(result.state!.lineStart).toBe(local.indexedBytes);

      const viaWorker = new LineIndex(source, enc);
      await viaWorker.indexWithWorker({ chunkSize: 4096 });
      expect(viaWorker.lineCount).toBe(local.lineCount);
      expect(viaWorker.checkpoints.count).toBe(local.checkpoints.count);
      expect((await viaWorker.getLines(0, 100000)).map((l) => l.text)).toEqual(gen.lines);
      for (const n of [0, 63, 64, 65, 128].filter((n) => n < local.lineCount)) {
        expect(await viaWorker.offsetOf(n)).toBe(await local.offsetOf(n));
      }
      await source.close();
    }
  });

  it("reprend un index entame (queue ajoutee) apres le worker", async () => {
    const path = await fileWith("a\nb\nc");
    const source = await FileSource.open(path, { cache: new BlockCache() });
    const index = new LineIndex(source, "utf-8");
    await index.indexWithWorker();
    expect(index.lineCount).toBe(3);
    writeFileSync(path, "a\nb\ncc\nd\n");
    await index.indexWithWorker();
    expect((await index.getLines(0, 10)).map((l) => l.text)).toEqual(["a", "b", "cc", "d"]);
    await source.close();
  });

  it("fichier vide", async () => {
    const result = await indexInWorker(await fileWith(""), "utf-8");
    expect(result.state).toBeNull();
  });

  it("fichier introuvable : SourceError typee", async () => {
    await expect(indexInWorker(join(await tempDir(), "absent.log"), "utf-8")).rejects.toMatchObject({ name: "SourceError", code: "ENOENT" });
  });

  it("progression rapportee, croissante", async () => {
    const lines = Array.from({ length: 60_000 }, (_, i) => `2026-10-14 10:02:11 INFO ligne ${i}`);
    const path = await fileWith(lines.join("\n") + "\n");
    const seen: IndexProgress[] = [];
    await indexInWorker(path, "utf-8", { chunkSize: 16 * 1024, progressIntervalMs: 0, onProgress: (p) => seen.push(p) });
    expect(seen.length).toBeGreaterThan(3);
    for (let i = 1; i < seen.length; i++) expect(seen[i]!.bytesRead).toBeGreaterThanOrEqual(seen[i - 1]!.bytesRead);
    const last = seen[seen.length - 1]!;
    expect(last.lines).toBe(60_000);
    expect(last.bytesRead).toBe(last.totalBytes);
  });

  it("annulable via AbortSignal", async () => {
    const path = await fileWith(Buffer.alloc(8 * 1024 * 1024, "line of text\n"));
    const controller = new AbortController();
    const pending = indexInWorker(path, "utf-8", {
      chunkSize: 32 * 1024,
      progressIntervalMs: 0,
      signal: controller.signal,
      onProgress: () => controller.abort(),
    });
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });

  it("signal deja annule : rejet immediat", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(indexInWorker(await fileWith("a\n"), "utf-8", { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
  });
});
