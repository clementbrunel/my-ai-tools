import { appendFileSync, truncateSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { BlockCache, CheckpointStore, FileSource, LineIndex, MAX_LINE_BYTES, type Encoding } from "../src/index";
import { bomFor, encode, generateFile, mulberry32 } from "./gen";
import { useTempDir } from "./helpers";

const tempDir = useTempDir();
const opened: FileSource[] = [];
afterEach(async () => {
  await Promise.all(opened.splice(0).map((s) => s.close()));
});

async function open(data: Buffer | string, encoding: Encoding = "utf-8", chunkSize?: number) {
  const path = join(await tempDir(), "t.log");
  writeFileSync(path, data);
  const source = await FileSource.open(path, { cache: new BlockCache() });
  opened.push(source);
  const index = new LineIndex(source, encoding, { chunkSize });
  return { path, source, index };
}

async function texts(index: LineIndex): Promise<string[]> {
  return (await index.getLines(0, index.lineCount + 5)).map((l) => l.text);
}

describe("LineIndex : cas simples", () => {
  it("fichier vide : 0 ligne", async () => {
    const { index } = await open("");
    await index.appendFrom();
    expect(index.lineCount).toBe(0);
    expect(index.isLastLineOpen).toBe(false);
    expect(await index.getLines(0, 10)).toEqual([]);
  });

  it("'a\\n' = 1 ligne fermee ; 'a' = 1 ligne ouverte", async () => {
    const closed = await open("a\n");
    await closed.index.appendFrom();
    expect(closed.index.lineCount).toBe(1);
    expect(closed.index.isLastLineOpen).toBe(false);
    expect(closed.index.indexedBytes).toBe(2);

    const opened = await open("a");
    await opened.index.appendFrom();
    expect(opened.index.lineCount).toBe(1);
    expect(opened.index.isLastLineOpen).toBe(true);
    expect(opened.index.indexedBytes).toBe(0);
  });

  it("BOM seul : 0 ligne", async () => {
    const { index } = await open(bomFor("utf-8"));
    await index.appendFrom();
    expect(index.lineCount).toBe(0);
  });

  it("CRLF, CR et LF melanges, lignes vides comprises", async () => {
    const { index } = await open("one\r\ntwo\rthree\n\nfive\r\n\r\nsept");
    await index.appendFrom();
    expect(await texts(index)).toEqual(["one", "two", "three", "", "five", "", "sept"]);
    expect(index.lineCount).toBe(7);
    expect(index.isLastLineOpen).toBe(true);
  });

  it("\\r\\n coupe a chaque position de chunk", async () => {
    const content = "aa\r\nbb\r\ncc\rdd\r\n";
    for (let chunk = 1; chunk <= content.length; chunk++) {
      const { index } = await open(content, "utf-8", chunk);
      await index.appendFrom();
      expect(await texts(index)).toEqual(["aa", "bb", "cc", "dd"]);
    }
  });

  it("getLines hors bornes", async () => {
    const { index } = await open("a\nb\n");
    await index.appendFrom();
    expect((await index.getLines(1, 100)).map((l) => [l.lineNo, l.text])).toEqual([[1, "b"]]);
    expect(await index.getLines(2, 1)).toEqual([]);
    expect(await index.getLines(-1, 1)).toEqual([]);
    await expect(index.offsetOf(2)).rejects.toBeInstanceOf(RangeError);
  });

  it("windows-1252", async () => {
    const { index } = await open(Buffer.from([0x63, 0x61, 0x66, 0xe9, 0x0a, 0x80, 0x0a]), "windows-1252");
    await index.appendFrom();
    expect(await texts(index)).toEqual(["café", "€"]);
  });
});

describe("LineIndex : UTF-16", () => {
  it.each<Encoding>(["utf-16le", "utf-16be"])("avec BOM (%s)", async (enc) => {
    const content = Buffer.concat([bomFor(enc), encode("alpha\r\nbeta\nੁgamma\rdelta", enc)]);
    const { index } = await open(content, enc);
    await index.appendFrom();
    expect(await texts(index)).toEqual(["alpha", "beta", "ੁgamma", "delta"]);
    expect(await index.offsetOf(1)).toBe(2 + 14);
    expect(index.isLastLineOpen).toBe(true);
  });
});

describe("LineIndex : ligne ouverte et croissance", () => {
  it("la derniere ligne est re-emise quand elle grandit", async () => {
    const { path, index } = await open("one\ntw");
    await index.appendFrom();
    expect(await texts(index)).toEqual(["one", "tw"]);
    expect(index.isLastLineOpen).toBe(true);

    appendFileSync(path, "o\nthree");
    const res = await index.appendFrom();
    expect(res).toEqual({ appendedBytes: 7, truncated: false });
    expect(await texts(index)).toEqual(["one", "two", "three"]);
    expect(index.lineCount).toBe(3);

    appendFileSync(path, "\n");
    await index.appendFrom();
    expect(index.lineCount).toBe(3);
    expect(index.isLastLineOpen).toBe(false);
    expect(index.indexedBytes).toBe(14);
  });

  it("\\r en fin de fichier puis \\n ajoute apres : pas de ligne fantome", async () => {
    const { path, index } = await open("a\r");
    await index.appendFrom();
    expect(await texts(index)).toEqual(["a"]);
    appendFileSync(path, "\nb\n");
    await index.appendFrom();
    expect(await texts(index)).toEqual(["a", "b"]);
  });

  it("\\r en fin de fichier puis texte : \\r etait bien un terminateur", async () => {
    const { path, index } = await open("a\r");
    await index.appendFrom();
    appendFileSync(path, "b");
    await index.appendFrom();
    expect(await texts(index)).toEqual(["a", "b"]);
  });

  it("UTF-16 : append coupe au milieu d'une unite", async () => {
    const full = Buffer.concat([bomFor("utf-16le"), encode("ab\ncd\n", "utf-16le")]);
    const { path, index } = await open(full.subarray(0, 7), "utf-16le");
    await index.appendFrom();
    appendFileSync(path, full.subarray(7));
    await index.appendFrom();
    expect(await texts(index)).toEqual(["ab", "cd"]);
  });

  it("troncature detectee, reset puis reindexation", async () => {
    const { path, index } = await open("one\ntwo\nthree\n");
    await index.appendFrom();
    truncateSync(path, 4);
    expect((await index.appendFrom()).truncated).toBe(true);
    index.reset();
    expect(index.lineCount).toBe(0);
    await index.appendFrom();
    expect(await texts(index)).toEqual(["one"]);
  });
});

describe("LineIndex : offsetOf et points de controle", () => {
  it("bords des points de controle (63, 64, 65, 128)", async () => {
    const lines = Array.from({ length: 300 }, (_, i) => `ligne ${i} ${"x".repeat(i % 17)}`);
    const offsets: number[] = [];
    let pos = 0;
    for (const l of lines) {
      offsets.push(pos);
      pos += l.length + 1;
    }
    const { index } = await open(lines.join("\n") + "\n", "utf-8", 1000);
    await index.appendFrom();
    expect(index.lineCount).toBe(300);
    for (const n of [0, 1, 62, 63, 64, 65, 127, 128, 129, 191, 192, 299]) {
      expect(await index.offsetOf(n)).toBe(offsets[n]);
    }
    expect((await index.getLines(60, 10)).map((l) => l.text)).toEqual(lines.slice(60, 70));
    expect(index.checkpoints.count).toBe(5); // lignes 0, 64, 128, 192, 256
  });

  it("budget memoire : 70 M lignes ~ 9 Mo de points de controle", () => {
    const store = new CheckpointStore();
    const count = Math.ceil(70_000_000 / 64);
    store.set(count - 1, 123456789012);
    expect(store.get(count - 1)).toBe(123456789012);
    expect(store.byteLength).toBeLessThan(count * 8 * 2);
    expect(count * 8).toBeLessThan(10 * 1024 * 1024);
  });
});

describe("LineIndex : lignes geantes", () => {
  it("affichage plafonne a 64 Ko, offsets exacts", async () => {
    const giant = "g".repeat(200_000);
    const content = `avant\n${giant}\r\napres\n`;
    for (const chunk of [undefined, 50_000, 4096]) {
      const { index } = await open(content, "utf-8", chunk);
      await index.appendFrom();
      expect(index.lineCount).toBe(3);
      const lines = await index.getLines(0, 3);
      expect(lines.map((l) => l.truncated)).toEqual([false, true, false]);
      expect(lines[1]!.text.length).toBe(MAX_LINE_BYTES);
      expect(lines[2]!.text).toBe("apres");
      expect(await index.offsetOf(2)).toBe(6 + 200_000 + 2);
    }
  });

  it("une ligne de exactement 64 Ko n'est pas tronquee", async () => {
    const { index } = await open("x".repeat(MAX_LINE_BYTES) + "\r\nfin\n");
    await index.appendFrom();
    const [first] = await index.getLines(0, 1);
    expect(first!.truncated).toBe(false);
    expect(first!.text.length).toBe(MAX_LINE_BYTES);
  });
});

describe("LineIndex : coherence avec un split naif (fichiers aleatoires)", () => {
  const encodings: Encoding[] = ["utf-8", "utf-16le", "utf-16be", "windows-1252"];
  for (const enc of encodings) {
    it(`seed 1..25 en ${enc}`, { timeout: 30_000 }, async () => {
      for (let seed = 1; seed <= 25; seed++) {
        const rand = mulberry32(seed * 7919);
        const gen = generateFile(rand, enc, { bom: enc !== "windows-1252" && rand() < 0.7 });
        const chunk = 2 * (1 + Math.floor(rand() * 120));
        const { index, source } = await open(gen.data, enc, chunk);
        await index.appendFrom();
        const ctx = `seed ${seed}, chunk ${chunk}`;
        expect(index.lineCount, ctx).toBe(gen.lines.length);
        expect((await texts(index)), ctx).toEqual(gen.lines);
        // fenetres aleatoires et offsets
        for (let k = 0; k < 5 && gen.lines.length > 0; k++) {
          const first = Math.floor(rand() * gen.lines.length);
          const count = 1 + Math.floor(rand() * 80);
          const got = await index.getLines(first, count);
          expect(got.map((l) => l.text), ctx).toEqual(gen.lines.slice(first, first + count));
          expect(got[0]!.lineNo).toBe(first);
          expect(await index.offsetOf(first), ctx).toBe(gen.offsets[first]);
        }
        await source.close();
      }
    });
  }

  it("indexation incrementale par morceaux == indexation d'un coup", async () => {
    for (let seed = 1; seed <= 20; seed++) {
      const rand = mulberry32(seed * 104729);
      const enc: Encoding = seed % 2 ? "utf-8" : "utf-16le";
      const gen = generateFile(rand, enc);
      const path = join(await tempDir(), "grow.log");
      writeFileSync(path, "");
      const source = await FileSource.open(path, { cache: new BlockCache() });
      opened.push(source);
      const index = new LineIndex(source, enc, { chunkSize: 64 });
      let at = 0;
      while (at < gen.data.length) {
        const step = 1 + Math.floor(rand() * 200);
        appendFileSync(path, gen.data.subarray(at, at + step));
        at += step;
        await index.appendFrom();
      }
      await index.appendFrom();
      expect(await texts(index), `seed ${seed}`).toEqual(gen.lines);
      await source.close();
    }
  });
});
