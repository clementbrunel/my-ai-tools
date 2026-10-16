import { randomBytes } from "node:crypto";
import { appendFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BLOCK_SIZE, BlockCache, FileSource, SourceError } from "../src/index";
import { useTempDir } from "./helpers";

const tempDir = useTempDir();

async function fileWith(content: Buffer | string, name = "a.log"): Promise<string> {
  const path = join(await tempDir(), name);
  writeFileSync(path, content);
  return path;
}

describe("FileSource.readAt", () => {
  it("lit a un offset donne", async () => {
    const path = await fileWith("0123456789");
    const src = await FileSource.open(path, { cache: new BlockCache() });
    expect((await src.readAt(3, 4)).toString()).toBe("3456");
    expect(await src.size()).toBe(10);
    await src.close();
  });

  it("lit a cheval sur plusieurs blocs de 64 Ko", async () => {
    const data = randomBytes(BLOCK_SIZE * 3 + 123);
    const src = await FileSource.open(await fileWith(data), { cache: new BlockCache() });
    for (const [offset, length] of [
      [BLOCK_SIZE - 5, 10],
      [BLOCK_SIZE, BLOCK_SIZE],
      [BLOCK_SIZE - 1, BLOCK_SIZE + 2],
      [10, BLOCK_SIZE * 2 + 50],
      [BLOCK_SIZE * 3, 123],
    ] as const) {
      const got = await src.readAt(offset, length);
      expect(got.equals(data.subarray(offset, offset + length))).toBe(true);
    }
    await src.close();
  });

  it("renvoie un buffer court au-dela de EOF, vide apres", async () => {
    const src = await FileSource.open(await fileWith("hello"), { cache: new BlockCache() });
    expect((await src.readAt(3, 100)).toString()).toBe("lo");
    expect((await src.readAt(5, 10)).length).toBe(0);
    expect((await src.readAt(BLOCK_SIZE * 5, 10)).length).toBe(0);
    await src.close();
  });

  it("evince en LRU sous un petit budget", async () => {
    const data = randomBytes(BLOCK_SIZE * 4);
    const cache = new BlockCache(BLOCK_SIZE * 2);
    const src = await FileSource.open(await fileWith(data), { cache });
    for (let i = 0; i < 4; i++) await src.readAt(i * BLOCK_SIZE, 10);
    expect(cache.byteSize).toBeLessThanOrEqual(BLOCK_SIZE * 2);
    expect(cache.blockCount).toBe(2);
    // les deux plus recents (2 et 3) restent, 0 est parti : relire 0 le re-cache et evince 2
    expect(cache.get(src.id, 0)).toBeUndefined();
    expect(cache.get(src.id, 3)).toBeDefined();
    await src.readAt(0, 10);
    expect(cache.get(src.id, 2)).toBeUndefined();
    expect(cache.get(src.id, 0)).toBeDefined();
    await src.close();
  });

  it("un bloc touche est rajeuni", async () => {
    const cache = new BlockCache(BLOCK_SIZE * 2);
    const src = await FileSource.open(await fileWith(randomBytes(BLOCK_SIZE * 3)), { cache });
    await src.readAt(0, 1);
    await src.readAt(BLOCK_SIZE, 1);
    await src.readAt(0, 1); // rajeunit 0
    await src.readAt(BLOCK_SIZE * 2, 1); // evince 1
    expect(cache.get(src.id, 1)).toBeUndefined();
    expect(cache.get(src.id, 0)).toBeDefined();
    await src.close();
  });

  it("ne sert pas une queue perimee quand le fichier grandit", async () => {
    const path = await fileWith("abc");
    const src = await FileSource.open(path, { cache: new BlockCache() });
    expect((await src.readAt(0, 100)).toString()).toBe("abc");
    appendFileSync(path, "def");
    expect((await src.readAt(0, 100)).toString()).toBe("abcdef");
    // idem quand le dernier bloc partiel devient plein puis deborde
    appendFileSync(path, Buffer.alloc(BLOCK_SIZE, 0x78));
    const all = await src.readAt(0, BLOCK_SIZE * 2);
    expect(all.length).toBe(6 + BLOCK_SIZE);
    expect(all.toString("latin1", 0, 6)).toBe("abcdef");
    await src.close();
  });

  it("invalidate() oublie les blocs de la source", async () => {
    const cache = new BlockCache();
    const src = await FileSource.open(await fileWith(randomBytes(BLOCK_SIZE * 2)), { cache });
    await src.readAt(0, BLOCK_SIZE * 2);
    expect(cache.blockCount).toBe(2);
    src.invalidate();
    expect(cache.blockCount).toBe(0);
    await src.close();
  });

  it("cache:false ne remplit pas le cache", async () => {
    const cache = new BlockCache();
    const src = await FileSource.open(await fileWith(randomBytes(BLOCK_SIZE * 2)), { cache });
    await src.readAt(5, BLOCK_SIZE, { cache: false });
    expect(cache.blockCount).toBe(0);
    await src.close();
  });
});

describe("erreurs typees", () => {
  it("ENOENT", async () => {
    const path = join(await tempDir(), "absent.log");
    await expect(FileSource.open(path)).rejects.toMatchObject({ name: "SourceError", code: "ENOENT" });
    await expect(FileSource.open(path)).rejects.toBeInstanceOf(SourceError);
  });

  it("dossier => EISDIR ou EACCES (selon la plateforme)", async () => {
    await expect(FileSource.open(await tempDir())).rejects.toMatchObject({ code: expect.stringMatching(/EISDIR|EACCES/) });
  });

  it("CLOSED apres close()", async () => {
    const src = await FileSource.open(await fileWith("x"));
    await src.close();
    await src.close(); // idempotent
    await expect(src.readAt(0, 1)).rejects.toMatchObject({ code: "CLOSED" });
    await expect(src.size()).rejects.toMatchObject({ code: "CLOSED" });
  });
});

describe("identity", () => {
  it("est stable pour un meme fichier et distincte entre deux fichiers", async () => {
    const dir = await tempDir();
    writeFileSync(join(dir, "a"), "a");
    writeFileSync(join(dir, "b"), "b");
    const a = await FileSource.open(join(dir, "a"));
    const b = await FileSource.open(join(dir, "b"));
    expect(await a.identity()).toEqual(await a.identity());
    expect(await a.identity()).not.toEqual(await b.identity());
    expect(typeof (await a.identity()).ino).toBe("string");
    await a.close();
    await b.close();
  });
});

// Protection contre une regression de libuv (FILE_SHARE_DELETE) : T-04c.
describe.skipIf(process.platform !== "win32")("partage Windows", () => {
  it("renommer / supprimer pendant que le handle est ouvert reussit", async () => {
    const dir = await tempDir();
    const log = join(dir, "SystemOut.log");
    const other = join(dir, "autre.log");
    writeFileSync(log, "ligne 1\nligne 2\n");
    writeFileSync(other, "autre");

    const src = await FileSource.open(log, { cache: new BlockCache() });
    const oldId = await src.identity();

    renameSync(log, join(dir, "SystemOut_26.10.14.log"));
    rmSync(other);

    // l'ancien handle lit toujours le contenu renomme
    expect((await src.readAt(0, 100, { cache: false })).toString()).toBe("ligne 1\nligne 2\n");

    // l'ecrivain recree le fichier : l'identite de l'ancien handle est differente
    writeFileSync(log, "neuf\n");
    const fresh = await FileSource.open(log, { cache: new BlockCache() });
    expect(await fresh.identity()).not.toEqual(oldId);
    expect(await src.identity()).toEqual(oldId);
    await fresh.close();
    await src.close();
  });
});
