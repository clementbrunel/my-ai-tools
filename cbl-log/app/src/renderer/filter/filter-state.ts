import { LEVELS, sameMatcher, type FilterSettings, type Level, type TextMatcher } from "@cbl-log/shared";

/** The level pills of the status bar: fatal and error share one (they are the same kind of problem). */
export const LEVEL_PILLS: readonly { id: string; label: string; levels: readonly Level[] }[] = [
  { id: "error", label: "ERROR", levels: ["fatal", "error"] },
  { id: "warn", label: "WARN", levels: ["warn"] },
  { id: "info", label: "INFO", levels: ["info"] },
  { id: "debug", label: "DEBUG", levels: ["debug"] },
  { id: "trace", label: "TRACE", levels: ["trace"] },
];
type Pill = (typeof LEVEL_PILLS)[number];

export const pillActive = (levels: readonly Level[], pill: Pill): boolean => pill.levels.every((l) => levels.includes(l));

/** Checks or unchecks one pill; the other levels are untouched. */
export function togglePill(levels: readonly Level[], pill: Pill): Level[] {
  const on = pillActive(levels, pill);
  return LEVELS.filter((l) => (pill.levels.includes(l) ? !on : levels.includes(l)));
}

/** Adds a matcher to the include or exclude list (the same one is not added twice). */
export function addMatcher(settings: FilterSettings, list: "include" | "exclude", matcher: TextMatcher): FilterSettings {
  if (matcher.pattern === "" || settings[list].some((m) => sameMatcher(m, matcher))) return settings;
  return { ...settings, [list]: [...settings[list], matcher] };
}

export function removeMatcher(settings: FilterSettings, list: "include" | "exclude", index: number): FilterSettings {
  return { ...settings, [list]: settings[list].filter((_, i) => i !== index) };
}

/** "N lignes affichées sur M" — undefined when no filter is in force. */
export function describeFilterCount(shown: number, total: number): string {
  return `${shown.toLocaleString("fr-FR")} ligne(s) affichée(s) sur ${total.toLocaleString("fr-FR")}`;
}

/** Nothing checked off, nothing typed: the same as no filter (not worth saving in the session). */
export const isDefaultFilter = (settings: FilterSettings): boolean =>
  settings.levels.length === LEVELS.length && settings.include.length === 0 && settings.exclude.length === 0;
