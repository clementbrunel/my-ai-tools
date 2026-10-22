import type { RuleSet } from "@cbl-log/shared";

/** The set proposed for a detected format: the first one that lists it, else the default one. */
export function autoRuleSet(sets: readonly RuleSet[], formatId: string | null | undefined): RuleSet | undefined {
  const byFormat = formatId ? sets.find((set) => set.formats.includes(formatId)) : undefined;
  return byFormat ?? sets.find((set) => set.id === "default") ?? sets[0];
}

/** The set in force for a tab: the user's choice when it still exists, otherwise the automatic one. */
export function pickRuleSet(sets: readonly RuleSet[], formatId: string | null | undefined, override: string | undefined): RuleSet | undefined {
  return (override ? sets.find((set) => set.id === override) : undefined) ?? autoRuleSet(sets, formatId);
}

/** A file-safe id derived from a profile name, not used by any of `sets` (`base`, `base-2`, `base-3`…). */
export function uniqueRuleSetId(sets: readonly RuleSet[], name: string): string {
  const slug = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "profil";
  let id = slug;
  for (let n = 2; sets.some((s) => s.id === id); n++) id = `${slug}-${n}`;
  return id;
}

const sameContent = (a: RuleSet, b: RuleSet): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * What importing a shared profile does: "new" when no profile has its id, "same" when the identical
 * profile is already there, "conflict" when a different profile has its id (the user picks replace or copy).
 */
export function importKind(sets: readonly RuleSet[], imported: RuleSet): "new" | "same" | "conflict" {
  const existing = sets.find((s) => s.id === imported.id);
  if (!existing) return "new";
  return sameContent(existing, imported) ? "same" : "conflict";
}

/** The imported profile kept beside an existing one with the same id: a fresh id and a name that tells them apart. */
export function importAsCopy(sets: readonly RuleSet[], imported: RuleSet): RuleSet {
  const name = `${imported.name || imported.id} (importé)`;
  return { ...imported, id: uniqueRuleSetId(sets, name), name };
}

/** `sets` with `set` added, or in place of the profile that has its id. */
export function withRuleSet(sets: readonly RuleSet[], set: RuleSet): RuleSet[] {
  return sets.some((s) => s.id === set.id) ? sets.map((s) => (s.id === set.id ? set : s)) : [...sets, set];
}
