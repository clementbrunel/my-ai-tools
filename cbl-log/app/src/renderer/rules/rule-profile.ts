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
