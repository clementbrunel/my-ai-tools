// Every text passed to t() has an English translation, with the same {placeholders}; no t() call takes
// anything but a plain string literal (the scan below could not check it).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EN, resolveLanguage, setLanguage, t } from "@cbl-log/shared";

const roots = [join(__dirname), join(__dirname, "../../packages/shared/src"), join(__dirname, "../../packages/engine/src")];

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "node_modules" || name === "i18n" ? [] : sources(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

/** Keys of every t("…") / t('…') call; bad = calls whose first argument is not a literal. */
function scan(): { keys: Map<string, string>; bad: string[] } {
  const keys = new Map<string, string>();
  const bad: string[] = [];
  for (const file of roots.flatMap(sources)) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/(?<![\w.$])t\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^)\s][^,)]*))/g)) {
      if (m[3] !== undefined) {
        bad.push(`${file}: t(${m[3]}`);
        continue;
      }
      const raw = m[1] ?? m[2]!;
      keys.set(JSON.parse(`"${raw.replace(/\\'/g, "'").replace(/(?<!\\)"/g, '\\"')}"`) as string, file);
    }
  }
  return { keys, bad };
}

const placeholders = (s: string): string[] => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort();

describe("i18n", () => {
  const { keys, bad } = scan();

  it("only calls t() with a string literal", () => {
    expect(bad).toEqual([]);
  });

  it("translates every text of the interface", () => {
    const missing = [...keys.keys()].filter((k) => !(k in EN));
    expect(missing).toEqual([]);
  });

  it("keeps the same placeholders in English", () => {
    const wrong = Object.entries(EN).filter(([fr, en]) => placeholders(fr).join() !== placeholders(en).join());
    expect(wrong).toEqual([]);
  });

  it("has no translation left over from a removed text", () => {
    expect(Object.keys(EN).filter((k) => !keys.has(k))).toEqual([]);
  });

  it("translates and fills the placeholders", () => {
    setLanguage("en");
    try {
      expect(t("Fermer")).toBe("Close");
      expect(t("absent {n}", { n: 3 })).toBe("absent 3");
    } finally {
      setLanguage("fr");
    }
    expect(t("Fermer")).toBe("Fermer");
  });

  it("follows Windows for the system setting", () => {
    expect(resolveLanguage("system", "fr-CA")).toBe("fr");
    expect(resolveLanguage("system", "en-GB")).toBe("en");
    expect(resolveLanguage("fr", "en-US")).toBe("fr");
  });
});
