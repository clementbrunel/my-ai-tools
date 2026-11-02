import { describe, expect, it } from "vitest";
import { parseChangelog, parseInline, parseNotes } from "./release-notes";

const md = `# Changelog

## [2.0.0] — 2026-10-20

- **Nouveau** : \`thème\` <b>
- Deuxième

## [1.0.0] — 2026-10-01

- Première
`;

describe("parseChangelog", () => {
  it("returns one entry per version section, newest first", () => {
    const e = parseChangelog(md);
    expect(e.map((x) => x.version)).toEqual(["2.0.0", "1.0.0"]);
    expect(e[0]!.date).toBe("2026-10-20");
    expect(e[0]!.lines).toHaveLength(2);
  });
});

describe("parseInline", () => {
  it("splits bold and code, reduces links to their text", () => {
    expect(parseInline("**Nouveau** : `thème` voir [la doc](https://x)")).toEqual([
      { text: "Nouveau", kind: "strong" },
      { text: " : ", kind: "text" },
      { text: "thème", kind: "code" },
      { text: " voir la doc", kind: "text" },
    ]);
  });
});

describe("parseNotes", () => {
  it("separates bullets from paragraphs", () => {
    expect(parseNotes("Intro\n- a\n* b\n\nFin")).toEqual({ bullets: ["a", "b"], paragraphs: ["Intro", "Fin"] });
  });
});
