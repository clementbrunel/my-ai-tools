import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadFormats } from "./formats-store";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("formats store", () => {
  it("loads valid formats, skips invalid ones with a warning, and creates the folder", async () => {
    const root = mkdtempSync(join(tmpdir(), "cbl-log-formats-"));
    dirs.push(root);
    const dir = join(root, "formats");
    expect((await loadFormats(dir)).formats).toEqual([]); // folder created on the fly

    writeFileSync(join(dir, "good.json"), JSON.stringify({ id: "good", detect: "^x", line: "^(?<msg>.*)$" }));
    writeFileSync(join(dir, "bad-regex.json"), JSON.stringify({ id: "bad", detect: "(", line: "^(?<msg>.*)$" }));
    writeFileSync(join(dir, "not-json.json"), "{");
    writeFileSync(join(dir, "notes.txt"), "ignored");
    const { formats, warnings } = await loadFormats(dir);
    expect(formats.map((f) => f.id)).toEqual(["good"]);
    expect(warnings).toHaveLength(2);
    expect(warnings.some((w) => w.startsWith("bad-regex.json"))).toBe(true);
  });
});
