import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BlockCache, FileSource, readTail, type Encoding } from "../src/index";
import { bomFor, encode, generateFile, mulberry32 } from "./gen";
import { useTempDir } from "./helpers";

const tempDir = useTempDir();

async function tailOf(data: Buffer, enc: Encoding, maxLines?: number) {
  const path = join(await tempDir(), "t.log");
  writeFileSync(path, data);
  const source = await FileSource.open(path, { cache: new BlockCache() });
  try {
    return await readTail(source, enc, maxLines);
  } finally {
    await source.close();
  }
}

describe("readTail", () => {
  it("fichier vide", async () => {
    const t = await tailOf(Buffer.alloc(0), "utf-8");
    expect(t.lines).toEqual([]);
    expect(t.isLastLineOpen).toBe(false);
  });

  it("petit fichier : tout, depuis le debut", async () => {
    const t = await tailOf(Buffer.from("a\r\nb\nc"), "utf-8");
    expect(t.lines.map((l) => l.text)).toEqual(["a", "b", "c"]);
    expect(t.startsAtFileStart).toBe(true);
    expect(t.isLastLineOpen).toBe(true);
    expect(t.endOffset).toBe(6);
  });

  it("ne garde que les maxLines dernieres", async () => {
    const lines = Array.from({ length: 5000 }, (_, i) => `ligne numero ${i}`);
    const t = await tailOf(Buffer.from(lines.join("\n") + "\n"), "utf-8", 10);
    expect(t.lines.map((l) => l.text)).toEqual(lines.slice(-10));
    expect(t.startsAtFileStart).toBe(false);
    expect(t.isLastLineOpen).toBe(false);
  });

  it("\\r\\n a cheval sur la frontiere de 64 Ko", async () => {
    // on place le \r\n pile autour de size - 64 Ko
    const total = 3 * 65536;
    for (const shift of [-1, 0, 1]) {
      const cut = total - 65536 + shift;
      const buf = Buffer.alloc(total, 0x61);
      buf[cut - 1] = 0x0d;
      buf[cut] = 0x0a;
      buf[total - 1] = 0x0a;
      const t = await tailOf(buf, "utf-8", 2);
      // lignes : [...a\r\n][aaaa...\n] => 2 dernieres lignes
      expect(t.lines.length).toBe(2);
      expect(t.lines[1]!.text.length).toBe(total - 1 - (cut + 1));
    }
  });

  it("dernier octet \\r (terminateur en attente)", async () => {
    const t = await tailOf(Buffer.from("a\nb\r"), "utf-8");
    expect(t.lines.map((l) => l.text)).toEqual(["a", "b"]);
  });

  it("UTF-16LE / BE avec BOM", async () => {
    for (const enc of ["utf-16le", "utf-16be"] as const) {
      const t = await tailOf(Buffer.concat([bomFor(enc), encode("x\r\ny\nz", enc)]), enc, 2);
      expect(t.lines.map((l) => l.text)).toEqual(["y", "z"]);
      expect(t.startOffset).toBe(2 + 6);
    }
  });

  it("ligne geante en queue : tronquee a l'affichage", async () => {
    const t = await tailOf(Buffer.from("debut\n" + "z".repeat(300_000)), "utf-8", 5);
    expect(t.lines.map((l) => l.truncated)).toEqual([false, true]);
    expect(t.lines[0]!.text).toBe("debut");
  });

  it.each<Encoding>(["utf-8", "utf-16le", "utf-16be", "windows-1252"])("== fin d'un split naif sur fichiers aleatoires (%s)", async (enc) => {
    for (let seed = 1; seed <= 12; seed++) {
      const rand = mulberry32(seed * 31337);
      const gen = generateFile(rand, enc, { maxLines: 2500, maxLen: 200 });
      const maxLines = 1 + Math.floor(rand() * 600);
      const t = await tailOf(gen.data, enc, maxLines);
      expect(t.lines.map((l) => l.text), `seed ${seed}`).toEqual(gen.lines.slice(-maxLines));
    }
  });
});
