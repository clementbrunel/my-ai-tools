// Pure helpers of the "Configuration" window (SettingsPanel.tsx), kept apart to be tested without a DOM.
import { t, defaultSetting, fmtNumber, settingKey, type SettingDoc, type SettingSection } from "@cbl-log/shared";

/** Lower case without accents, for the search field. */
const fold = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Sections keeping the settings whose label, description, key or section title contain every word of `query`. */
export function filterSections(sections: readonly SettingSection[], query: string): SettingSection[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...sections];
  return sections
    .map((section) => ({
      ...section,
      settings: section.settings.filter((doc) => {
        const hay = fold(`${section.title} ${doc.label} ${doc.description} ${doc.details ?? ""} ${settingKey(doc.path)}`);
        return words.every((w) => hay.includes(w));
      }),
    }))
    .filter((section) => section.settings.length > 0);
}

type FlagOption = Extract<SettingDoc["control"], { kind: "flags" }>["options"][number];

/** Stored values a flag option stands for (ERROR = fatal + error). */
export const flagValues = (option: FlagOption): readonly string[] => option.values ?? [option.value];

/** The option is checked when all its values are. */
export const flagChecked = (on: readonly string[], option: FlagOption): boolean => flagValues(option).every((v) => on.includes(v));

/** Checks or unchecks `option`, in the options' order (the values of the other options are kept as they are). */
export function toggleFlag(options: readonly FlagOption[], on: readonly string[], option: FlagOption, checked: boolean): string[] {
  const own = flagValues(option);
  return options.flatMap(flagValues).filter((v) => (own.includes(v) ? checked : on.includes(v)));
}

/** How a value is shown in the "Rétablir" tooltip (the default value). */
export function formatValue(doc: SettingDoc, value: unknown): string {
  const control = doc.control;
  if (value === undefined) return control.kind === "text" ? (control.emptyLabel ?? t("(automatique)")) : "—";
  switch (control.kind) {
    case "boolean":
      return value ? t("activé") : t("désactivé");
    case "enum":
      return control.options.find((o) => o.value === value)?.label ?? String(value);
    case "number":
      return `${fmtNumber(value as number)}${control.unit ? ` ${control.unit}` : ""}`;
    case "flags": {
      const on = (value ?? []) as readonly string[];
      const checked = control.options.filter((o) => flagChecked(on, o));
      return checked.length === control.options.length ? t("tous") : checked.map((o) => o.label).join(", ");
    }
    case "map":
      return Object.keys(value as object).length === 0 ? t("aucun") : t("{n} entrée(s)", { n: Object.keys(value as object).length });
    default:
      return String(value);
  }
}

/** Whether `value` equals the default of the setting (maps: both empty). */
export function isDefault(doc: SettingDoc, value: unknown): boolean {
  const fallback = defaultSetting(doc.path);
  if (doc.control.kind === "map") return Object.keys((value ?? {}) as object).length === 0;
  if (doc.control.kind === "flags") {
    const a = (value ?? []) as readonly string[];
    const b = (fallback ?? []) as readonly string[];
    return a.length === b.length && a.every((v) => b.includes(v));
  }
  return value === fallback;
}
