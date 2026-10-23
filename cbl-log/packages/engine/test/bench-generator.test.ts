// Keeps the bench log generator from rotting: it is not part of CI otherwise (too slow at 10 GB).
import { readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { generateLogFile, LineGenerator } from "../bench/generator";
import { formatBytes, parseSize } from "../bench/util";
import { useTempDir } from "./helpers";

const ONE_MIB = 1024 * 1024;
const tempDir = useTempDir();

describe("bench log generator", () => {
  it("writes exactly the requested size, ends with a newline and is ASCII", async () => {
    const dir = await tempDir();
    const { path, reused } = await generateLogFile({ dir, format: "websphere-basic", sizeBytes: ONE_MIB });
    const content = readFileSync(path);
    expect(reused).toBe(false);
    expect(content.length).toBe(ONE_MIB);
    expect(content[content.length - 1]).toBe(0x0a);
    expect(content.every((byte) => byte < 0x80)).toBe(true);
  });

  it("produces websphere-basic lines, with varied levels and multi-line stack traces", async () => {
    const dir = await tempDir();
    const { path } = await generateLogFile({ dir, format: "websphere-basic", sizeBytes: ONE_MIB });
    const lines = readFileSync(path, "latin1").split("\n");
    const header = /^\[\d\d\/\d\d\/\d\d \d\d:\d\d:\d\d:\d{3} CEST\] [0-9a-f]{8} \S+\s+[A-Z] /;
    const sample = lines.slice(0, 200);
    expect(sample.some((line) => header.test(line))).toBe(true);
    expect(lines.some((line) => line.startsWith("\tat "))).toBe(true);
    const levels = new Set(lines.filter((line) => header.test(line)).map((line) => /\] \S+ \S+\s+([A-Z]) /.exec(line)?.[1]));
    expect(levels.size).toBeGreaterThanOrEqual(4);
  });

  it("produces raw lines without timestamp", async () => {
    const dir = await tempDir();
    const { path } = await generateLogFile({ dir, format: "raw", sizeBytes: ONE_MIB });
    expect(statSync(path).size).toBe(ONE_MIB);
    expect(readFileSync(path, "latin1").startsWith("[")).toBe(false);
  });

  it("reuses an existing file of the right size and regenerates it with force", async () => {
    const dir = await tempDir();
    const first = await generateLogFile({ dir, format: "raw", sizeBytes: ONE_MIB });
    const second = await generateLogFile({ dir, format: "raw", sizeBytes: ONE_MIB });
    expect(second.path).toBe(first.path);
    expect(second.reused).toBe(true);
    const forced = await generateLogFile({ dir, format: "raw", sizeBytes: ONE_MIB, force: true });
    expect(forced.reused).toBe(false);
    expect(statSync(forced.path).size).toBe(ONE_MIB);
  });

  it("is deterministic for a given seed", () => {
    const a = new LineGenerator("websphere-basic", 42);
    const b = new LineGenerator("websphere-basic", 42);
    const c = new LineGenerator("websphere-basic", 43);
    const take = (g: LineGenerator): string => Array.from({ length: 50 }, () => g.next()).join("");
    const first = take(a);
    expect(take(b)).toBe(first);
    expect(take(c)).not.toBe(first);
  });
});

describe("bench size helpers", () => {
  it("parses sizes with binary units", () => {
    expect(parseSize("4096")).toBe(4096);
    expect(parseSize("200M")).toBe(200 * ONE_MIB);
    expect(parseSize("10G")).toBe(10 * 1024 ** 3);
    expect(parseSize("1.5g")).toBe(1.5 * 1024 ** 3);
    expect(() => parseSize("lots")).toThrow(/Invalid size/);
  });

  it("formats sizes", () => {
    expect(formatBytes(ONE_MIB)).toBe("1.0 MiB");
  });
});
