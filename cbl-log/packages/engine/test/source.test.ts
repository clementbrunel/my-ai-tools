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
  it("reads at a given offset", async () => {
    const path = await fileWith("0123456789");
    const src = await FileSource.open(path, { cache: new BlockCache() });
    expect((await src.readAt(3, 4)).toString()).toBe("3456");
    expect(await src.size()).toBe(10);
    await src.close();
  });

  it("reads across several 64 KB blocks", async () => {
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

  it("returns a short buffer beyond EOF, an empty one after", async () => {
    const src = await FileSource.open(await fileWith("hello"), { cache: new BlockCache() });
    expect((await src.readAt(3, 100)).toString()).toBe("lo");
    expect((await src.readAt(5, 10)).length).toBe(0);
    expect((await src.readAt(BLOCK_SIZE * 5, 10)).length).toBe(0);
    await src.close();
  });

  it("evicts in LRU order under a small budget", async () => {
    const data = randomBytes(BLOCK_SIZE * 4);
    const cache = new BlockCache(BLOCK_SIZE * 2);
    const src = await FileSource.open(await fileWith(data), { cache });
    for (let i = 0; i < 4; i++) await src.readAt(i * BLOCK_SIZE, 10);
    expect(cache.byteSize).toBeLessThanOrEqual(BLOCK_SIZE * 2);
    expect(cache.blockCount).toBe(2);
    // the two most recent (2 and 3) stay, 0 is gone: re-reading 0 caches it again and evicts 2
    expect(cache.get(src.id, 0)).toBeUndefined();
    expect(cache.get(src.id, 3)).toBeDefined();
    await src.readAt(0, 10);
    expect(cache.get(src.id, 2)).toBeUndefined();
    expect(cache.get(src.id, 0)).toBeDefined();
    await src.close();
  });

  it("a touched block is refreshed", async () => {
    const cache = new BlockCache(BLOCK_SIZE * 2);
    const src = await FileSource.open(await fileWith(randomBytes(BLOCK_SIZE * 3)), { cache });
    await src.readAt(0, 1);
    await src.readAt(BLOCK_SIZE, 1);
    await src.readAt(0, 1); // refreshes 0
    await src.readAt(BLOCK_SIZE * 2, 1); // evicts 1
    expect(cache.get(src.id, 1)).toBeUndefined();
    expect(cache.get(src.id, 0)).toBeDefined();
    await src.close();
  });

  it("does not serve a stale tail when the file grows", async () => {
    const path = await fileWith("abc");
    const src = await FileSource.open(path, { cache: new BlockCache() });
    expect((await src.readAt(0, 100)).toString()).toBe("abc");
    appendFileSync(path, "def");
    expect((await src.readAt(0, 100)).toString()).toBe("abcdef");
    // same when the last partial block becomes full then overflows
    appendFileSync(path, Buffer.alloc(BLOCK_SIZE, 0x78));
    const all = await src.readAt(0, BLOCK_SIZE * 2);
    expect(all.length).toBe(6 + BLOCK_SIZE);
    expect(all.toString("latin1", 0, 6)).toBe("abcdef");
    await src.close();
  });

  it("invalidate() forgets the source's blocks", async () => {
    const cache = new BlockCache();
    const src = await FileSource.open(await fileWith(randomBytes(BLOCK_SIZE * 2)), { cache });
    await src.readAt(0, BLOCK_SIZE * 2);
    expect(cache.blockCount).toBe(2);
    src.invalidate();
    expect(cache.blockCount).toBe(0);
    await src.close();
  });

  it("cache:false does not fill the cache", async () => {
    const cache = new BlockCache();
    const src = await FileSource.open(await fileWith(randomBytes(BLOCK_SIZE * 2)), { cache });
    await src.readAt(5, BLOCK_SIZE, { cache: false });
    expect(cache.blockCount).toBe(0);
    await src.close();
  });
});

describe("typed errors", () => {
  it("ENOENT", async () => {
    const path = join(await tempDir(), "absent.log");
    await expect(FileSource.open(path)).rejects.toMatchObject({ name: "SourceError", code: "ENOENT" });
    await expect(FileSource.open(path)).rejects.toBeInstanceOf(SourceError);
  });

  it("directory => EISDIR or EACCES (depending on the platform)", async () => {
    await expect(FileSource.open(await tempDir())).rejects.toMatchObject({ code: expect.stringMatching(/EISDIR|EACCES/) });
  });

  it("CLOSED after close()", async () => {
    const src = await FileSource.open(await fileWith("x"));
    await src.close();
    await src.close(); // idempotent
    await expect(src.readAt(0, 1)).rejects.toMatchObject({ code: "CLOSED" });
    await expect(src.size()).rejects.toMatchObject({ code: "CLOSED" });
  });
});

describe("identity", () => {
  it("is stable for the same file and distinct between two files", async () => {
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

// Guards against a libuv regression (FILE_SHARE_DELETE): T-04c.
describe.skipIf(process.platform !== "win32")("partage Windows", () => {
  it("renaming / deleting while the handle is open succeeds", async () => {
    const dir = await tempDir();
    const log = join(dir, "SystemOut.log");
    const other = join(dir, "autre.log");
    writeFileSync(log, "ligne 1\nligne 2\n");
    writeFileSync(other, "autre");

    const src = await FileSource.open(log, { cache: new BlockCache() });
    const oldId = await src.identity();

    renameSync(log, join(dir, "SystemOut_26.10.14.log"));
    rmSync(other);

    // the old handle still reads the renamed content
    expect((await src.readAt(0, 100, { cache: false })).toString()).toBe("ligne 1\nligne 2\n");

    // the writer recreates the file: the old handle's identity is different
    writeFileSync(log, "neuf\n");
    const fresh = await FileSource.open(log, { cache: new BlockCache() });
    expect(await fresh.identity()).not.toEqual(oldId);
    expect(await src.identity()).toEqual(oldId);
    await fresh.close();
    await src.close();
  });
});
