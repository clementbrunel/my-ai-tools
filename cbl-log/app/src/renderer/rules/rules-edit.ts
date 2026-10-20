import type { HighlightRule } from "@cbl-log/shared";

/** Pure list operations behind the rules editor (every edit returns a new array). */

export function newRuleId(rules: readonly HighlightRule[]): string {
  const taken = new Set(rules.map((r) => r.id));
  for (let n = rules.length + 1; ; n++) if (!taken.has(`rule-${n}`)) return `rule-${n}`;
}

export function createRule(rules: readonly HighlightRule[]): HighlightRule {
  return {
    id: newRuleId(rules),
    name: "",
    pattern: "",
    isRegex: false,
    caseSensitive: false,
    wholeWord: false,
    bg: "#f29900",
    scope: "line",
    enabled: true,
  };
}

export function updateRule(rules: readonly HighlightRule[], id: string, patch: Partial<HighlightRule>): HighlightRule[] {
  return rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule));
}

export function removeRule(rules: readonly HighlightRule[], id: string): HighlightRule[] {
  return rules.filter((rule) => rule.id !== id);
}

/** Moves a rule to `toIndex` (its final position in the list); no-op for an unknown id or an out-of-range index. */
export function moveRuleTo(rules: readonly HighlightRule[], id: string, toIndex: number): HighlightRule[] {
  const from = rules.findIndex((rule) => rule.id === id);
  if (from === -1 || toIndex < 0 || toIndex >= rules.length) return [...rules];
  const next = [...rules];
  const [moved] = next.splice(from, 1);
  next.splice(toIndex, 0, moved!);
  return next;
}
