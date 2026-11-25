// Interface language (settings.language, applied at the next launch). The French text is the key:
// `t("Fermer l'onglet")` returns it as is in French and its translation from `en.ts` in English, so the
// code reads like the French UI and a missing translation falls back to French (a test lists them).
// The renderer knows the language before any of its modules runs (the preload exposes it as
// window.cblLogLang); the main process sets its own with setLanguage() once settings.json is read,
// before building its menus. The engine has no text of its own (its errors are mapped by the renderer).
import { EN } from "./en.js";

export { EN };

export type Language = "fr" | "en";
export type LanguageSetting = "system" | Language;

function detect(): Language {
  return (globalThis as { cblLogLang?: unknown }).cblLogLang === "en" ? "en" : "fr";
}

let current: Language = detect();

export const language = (): Language => current;
export const setLanguage = (lang: Language): void => {
  current = lang;
};

/** "system": French for a French Windows (any fr-* locale), English otherwise. */
export const resolveLanguage = (setting: LanguageSetting, systemLocale: string): Language =>
  setting === "system" ? (systemLocale.toLowerCase().startsWith("fr") ? "fr" : "en") : setting;

/** Text in the current language; `{name}` placeholders are replaced by `vars`. */
export function t(fr: string, vars?: Readonly<Record<string, string | number>>): string {
  const text = current === "en" ? (EN[fr] ?? fr) : fr;
  return vars ? text.replace(/\{(\w+)\}/g, (whole, key: string) => (key in vars ? String(vars[key]) : whole)) : text;
}

/** BCP 47 locale of the interface, for numbers and dates. */
export const locale = (): string => (current === "en" ? "en-US" : "fr-FR");

/** A number written the way the interface language does (1 234 / 1,234). */
export const fmtNumber = (n: number): string => n.toLocaleString(locale());
