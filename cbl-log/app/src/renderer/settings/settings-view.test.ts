import { describe, expect, it } from "vitest";
import {
  SETTING_SECTIONS,
  checkSettingsText,
  defaultSettings,
  getSetting,
  lineOfPath,
  setSetting,
  settingKey,
  settingsSchema,
  settingsToText,
  fontStack,
  rowHeightFor,
} from "@cbl-log/shared";
import { filterSections, formatValue, isDefault } from "./settings-view";

const docs = SETTING_SECTIONS.flatMap((s) => s.settings);
const doc = (key: string) => docs.find((d) => settingKey(d.path) === key)!;

describe("settings documentation", () => {
  it("documents every key of the schema (top level and nested groups)", () => {
    const documented = new Set(docs.map((d) => settingKey(d.path)));
    const nested = { docker: ["host"], viewer: ["fontFamily"], tabs: [] as string[] } as const;
    const top = Object.keys(settingsSchema.shape).filter((k) => k !== "schemaVersion" && !(k in nested));
    const inner = Object.entries(nested).flatMap(([group, optional]) =>
      Object.keys(defaultSettings()[group as keyof typeof nested]).concat(optional).map((k) => `${group}.${k}`),
    );
    for (const key of [...top, ...inner]) expect(documented, key).toContain(key);
  });

  it("each documented path exists in the defaults or is optional text", () => {
    for (const d of docs) if (d.control.kind !== "text") expect(getSetting(defaultSettings(), d.path), settingKey(d.path)).not.toBeUndefined();
  });
});

describe("getSetting / setSetting", () => {
  it("sets a nested value without touching the original", () => {
    const base = defaultSettings();
    const next = setSetting(base, ["docker", "initialTail"], 42);
    expect(next.docker.initialTail).toBe(42);
    expect(base.docker.initialTail).toBe(5000);
    expect(next.docker.spoolMaxMb).toBe(base.docker.spoolMaxMb);
  });

  it("removes a key set to undefined", () => {
    const withHost = setSetting(defaultSettings(), ["docker", "host"], "tcp://x:2375");
    expect(getSetting(withHost, ["docker", "host"])).toBe("tcp://x:2375");
    expect("host" in setSetting(withHost, ["docker", "host"], undefined).docker).toBe(false);
  });
});

describe("checkSettingsText", () => {
  it("accepts the default text", () => {
    const r = checkSettingsText(settingsToText(defaultSettings()));
    expect(r).toEqual({ ok: true, value: defaultSettings(), warnings: [] });
  });

  it("fills the defaults of a sparse file", () => {
    const r = checkSettingsText('{ "schemaVersion": 1, "historyHours": 6 }');
    expect(r.ok && r.value.historyHours).toBe(6);
    expect(r.ok && r.value.theme).toBe("system");
  });

  it("reports a syntax error with its line", () => {
    const r = checkSettingsText('{\n  "schemaVersion": 1,\n  "theme": "dark"\n  "historyHours": 3\n}');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]).toMatch(/^JSON invalide/);
      expect(r.line).toBe(4);
    }
  });

  it("reports a schema error in French, located on the key", () => {
    const text = settingsToText(setSetting(defaultSettings(), ["docker", "initialTail"], 0));
    const r = checkSettingsText(text);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]).toBe("docker.initialTail — valeur minimale : 1");
      expect(r.line).toBe(lineOfPath(text, ["docker", "initialTail"]));
      expect(text.split("\n")[r.line! - 1]).toContain('"initialTail"');
    }
  });

  it("lists the allowed values of an enum", () => {
    const r = checkSettingsText('{ "schemaVersion": 1, "theme": "blue" }');
    expect(!r.ok && r.errors[0]).toBe('theme — valeurs possibles : "system", "dark", "light"');
  });

  it("warns about unknown keys", () => {
    const r = checkSettingsText('{ "schemaVersion": 1, "fontSize": 14, "docker": { "hots": "x" } }');
    expect(r.ok && r.warnings).toEqual(["Clé inconnue « fontSize » : elle sera ignorée.", "Clé inconnue « docker.hots » : elle sera ignorée."]);
  });

  it("refuses a newer schema version", () => {
    const r = checkSettingsText('{ "schemaVersion": 2 }');
    expect(r.ok).toBe(false);
  });
});

describe("settings view helpers", () => {
  it("filters on label, description and key, ignoring accents and case", () => {
    expect(filterSections(SETTING_SECTIONS, "HISTORIQUE").flatMap((s) => s.settings).length).toBeGreaterThan(0);
    expect(filterSections(SETTING_SECTIONS, "spoolmaxmb").flatMap((s) => s.settings.map((d) => settingKey(d.path)))).toEqual(["docker.spoolMaxMb"]);
    expect(filterSections(SETTING_SECTIONS, "")).toHaveLength(SETTING_SECTIONS.length);
    expect(filterSections(SETTING_SECTIONS, "zzzz")).toEqual([]);
  });

  it("formats values for display", () => {
    expect(formatValue(doc("theme"), "dark")).toBe("Sombre");
    expect(formatValue(doc("checkForUpdates"), false)).toBe("désactivé");
    expect(formatValue(doc("docker.host"), undefined)).toBe("(automatique)");
    expect(formatValue(doc("historyHours"), 2)).toBe("2 h");
  });

  it("tells a modified setting from a default one", () => {
    expect(isDefault(doc("historyHours"), 2)).toBe(true);
    expect(isDefault(doc("historyHours"), 3)).toBe(false);
    expect(isDefault(doc("archivePatterns"), {})).toBe(true);
    expect(isDefault(doc("archivePatterns"), { a: "b" })).toBe(false);
    expect(isDefault(doc("docker.host"), undefined)).toBe(true);
  });
});

describe("log font (settings.viewer)", () => {
  it("defaults to Consolas 13 px on 18 px rows, as before the setting existed", () => {
    expect(defaultSettings().viewer).toEqual({ fontSize: 13, showLineNumbers: true });
    expect(rowHeightFor(13)).toBe(18);
    expect(fontStack(undefined)).toBe('"Consolas", "Courier New", monospace');
  });

  it("puts the chosen font first, keeps the fallbacks once and strips quotes", () => {
    expect(fontStack("Cascadia Mono")).toBe('"Cascadia Mono", "Consolas", "Courier New", monospace');
    expect(fontStack(" consolas ")).toBe('"consolas", "Courier New", monospace');
    expect(fontStack('Evil", serif')).toBe('"Evil, serif", "Consolas", "Courier New", monospace');
  });

  it("grows the row height with the font size", () => {
    expect(rowHeightFor(8)).toBe(11);
    expect(rowHeightFor(16)).toBe(22);
    expect(rowHeightFor(32)).toBe(45);
  });

  it("rejects a size out of bounds and warns on an unknown viewer key", () => {
    const base = JSON.parse(settingsToText(defaultSettings()));
    const tooBig = checkSettingsText(JSON.stringify({ ...base, viewer: { fontSize: 40 } }, null, 2));
    expect(tooBig.ok).toBe(false);
    if (!tooBig.ok) expect(tooBig.errors[0]).toContain("viewer.fontSize");
    const unknown = checkSettingsText(JSON.stringify({ ...base, viewer: { fontSize: 14, wrap: true } }, null, 2));
    expect(unknown.ok && unknown.warnings).toEqual(["Clé inconnue « viewer.wrap » : elle sera ignorée."]);
  });

  it("shows an empty font as Consolas", () => {
    expect(formatValue(doc("viewer.fontFamily"), undefined)).toBe("Consolas");
    expect(formatValue(doc("viewer.fontSize"), 13)).toBe("13 px");
  });
});

describe("flags control (tabs.levels)", () => {
  it("shows all / the checked levels and compares as a set", () => {
    const levels = doc("tabs.levels");
    expect(formatValue(levels, ["fatal", "error", "warn", "info", "debug", "trace"])).toBe("tous");
    expect(formatValue(levels, ["warn", "error"])).toBe("ERROR, WARN");
    expect(isDefault(levels, ["trace", "debug", "info", "warn", "error", "fatal"])).toBe(true);
    expect(isDefault(levels, ["error"])).toBe(false);
  });

  it("rejects an empty level list", () => {
    const base = JSON.parse(settingsToText(defaultSettings()));
    expect(checkSettingsText(JSON.stringify({ ...base, tabs: { levels: [] } })).ok).toBe(false);
  });
});
