// Notifications on new lines matching a highlighting rule marked "notify" (bell in the rules editor).
// The renderer reads the lines appended to a followed file, tests them against those rules, and
// shows one Windows notification per (tab, rule), grouped and throttled so that a burst of errors
// does not flood the screen.
import { t, fmtNumber, MAX_ROWS_PER_REQUEST, type Row } from "@cbl-log/shared";
import { MAX_MATCHED_CHARS, type CompiledRule } from "../highlight/highlight";

/** Lines read at most per check (one engine request): a file that grows by more only has its last lines tested. */
export const MAX_ALERT_ROWS = MAX_ROWS_PER_REQUEST;
/** After a notification, the same rule of the same tab waits this long (its hits are counted meanwhile). */
export const ALERT_COOLDOWN_MS = 30_000;

export interface RuleHit {
  ruleId: string;
  ruleName: string;
  count: number;
  /** First matching line (0-based line number of the tab). */
  line: number;
  text: string;
}

/** Rules that notify, among the compiled (enabled, valid) ones. */
export const notifyingRules = (compiled: readonly CompiledRule[]): CompiledRule[] => compiled.filter((c) => c.rule.notify === true);

/** Hits of each rule in `rows`, in rule order. */
export function matchAlerts(rows: readonly Row[], rules: readonly CompiledRule[]): RuleHit[] {
  const hits: RuleHit[] = [];
  for (const { rule, regex } of rules) {
    let hit: RuleHit | undefined;
    for (const row of rows) {
      regex.lastIndex = 0;
      if (!regex.test(row.text.slice(0, MAX_MATCHED_CHARS))) continue;
      if (hit) hit.count++;
      else hit = { ruleId: rule.id, ruleName: rule.name || rule.pattern, count: 1, line: row.lineNo, text: row.text };
    }
    if (hit) hits.push(hit);
  }
  return hits;
}

/** Window of lines to test after the file grew from `checked` to `total` rows (empty if it did not grow). */
export function rowsToCheck(checked: number, total: number, max = MAX_ALERT_ROWS): { first: number; count: number } {
  if (total <= checked) return { first: total, count: 0 };
  const first = Math.max(checked, total - max);
  return { first, count: total - first };
}

/** Groups the hits of a (tab, rule) during its cooldown; `take` says what to notify now, if anything. */
export class AlertThrottle {
  private readonly last = new Map<string, number>();
  private readonly held = new Map<string, RuleHit>();

  constructor(private readonly cooldownMs = ALERT_COOLDOWN_MS) {}

  /** Records `hit` for `key`; returns the hit to notify now (with the hits held meanwhile), or undefined. */
  take(key: string, hit: RuleHit, now: number): RuleHit | undefined {
    const held = this.held.get(key);
    const merged = held ? { ...held, count: held.count + hit.count } : hit;
    const last = this.last.get(key);
    if (last !== undefined && now - last < this.cooldownMs) {
      this.held.set(key, merged);
      return undefined;
    }
    this.held.delete(key);
    this.last.set(key, now);
    return merged;
  }

  /** Held hits whose cooldown is over (to be notified even if no new line comes). */
  due(now: number): [string, RuleHit][] {
    const out: [string, RuleHit][] = [];
    for (const [key, hit] of this.held) {
      if (now - (this.last.get(key) ?? 0) >= this.cooldownMs) {
        this.held.delete(key);
        this.last.set(key, now);
        out.push([key, hit]);
      }
    }
    return out;
  }

  /** Forgets a tab (closed). */
  forget(prefix: string): void {
    for (const map of [this.last, this.held]) for (const key of [...map.keys()]) if (key.startsWith(prefix)) map.delete(key);
  }
}

/** Text of the notification: title, then body. */
export function alertText(tabName: string, hit: RuleHit): { title: string; body: string } {
  const line = hit.text.length > 160 ? `${hit.text.slice(0, 160)}…` : hit.text;
  const count = hit.count > 1 ? t(" ({n} lignes)", { n: fmtNumber(hit.count) }) : "";
  return { title: `${hit.ruleName}${count} — ${tabName}`, body: t("Ligne {n} : {text}", { n: fmtNumber(hit.line + 1), text: line.trim() }) };
}
