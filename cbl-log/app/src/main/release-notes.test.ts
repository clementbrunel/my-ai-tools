import { describe, expect, it } from "vitest";
import { parseChangelog, releaseNotesHtml } from "./release-notes";

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

describe("releaseNotesHtml", () => {
  const entries = parseChangelog(md);
  it("lists all versions and flags the installed one", () => {
    const html = releaseNotesHtml(entries, "2.0.0", false);
    expect(html).toContain('id="v1.0.0"');
    expect(html).toContain("installée</span>");
    expect(html).toContain("20 octobre 2026");
  });
  it("shows only the installed version when asked", () => {
    const html = releaseNotesHtml(entries, "1.0.0", false, true);
    expect(html).not.toContain('id="v2.0.0"');
    expect(html).toContain('id="v1.0.0"');
  });
  it("escapes html and renders bold / code", () => {
    const html = releaseNotesHtml(entries, "2.0.0", false);
    expect(html).toContain("<strong>Nouveau</strong>");
    expect(html).toContain("<code>thème</code>");
    expect(html).toContain("&lt;b&gt;");
  });
  it("says so when the version has no notes", () => {
    expect(releaseNotesHtml(entries, "9.9.9", false, true)).toContain("Aucune note disponible");
  });
});
