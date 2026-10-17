import { patternSource, type HighlightRule } from "@cbl-log/shared";

/** Only this many leading characters of a line are matched (keeps a 64 KB line cheap). */
export const MAX_MATCHED_CHARS = 4000;
/** Opacity of rule backgrounds, so the same colors work on light and dark themes. */
export const BACKGROUND_ALPHA = 0.3;

export interface Segment {
  text: string;
  fg?: string;
  bg?: string;
}

export interface HighlightResult {
  lineFg?: string;
  lineBg?: string;
  segments: Segment[];
}

export interface CompiledRule {
  rule: HighlightRule;
  regex: RegExp;
}

export interface CompiledRules {
  compiled: CompiledRule[];
  /** Rule id -> reason, for enabled rules that could not be compiled (shown in the editor). */
  errors: Record<string, string>;
}

/** Compiles the enabled rules, in order. Invalid or empty patterns are skipped and reported. */
export function compileRules(rules: readonly HighlightRule[]): CompiledRules {
  const compiled: CompiledRule[] = [];
  const errors: Record<string, string> = {};
  for (const rule of rules) {
    if (!rule.enabled || rule.pattern === "") continue;
    try {
      compiled.push({ rule, regex: new RegExp(patternSource(rule), rule.caseSensitive ? "g" : "gi") });
    } catch (err) {
      errors[rule.id] = err instanceof Error ? err.message : String(err);
    }
  }
  return { compiled, errors };
}

/** `#rrggbb` -> `rgba(r, g, b, alpha)`. */
export function withAlpha(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

interface Range {
  start: number;
  end: number;
  fg?: string;
  bg?: string;
}

const overlaps = (ranges: readonly Range[], start: number, end: number): boolean =>
  ranges.some((r) => start < r.end && end > r.start);

/**
 * Applies the rules to one line. Line-scope rules: the first matching one colors the whole line.
 * Fragment-scope rules: every match is colored; on overlaps the earlier rule (then the earlier
 * match) wins.
 */
export function highlightLine(text: string, rules: readonly CompiledRule[]): HighlightResult {
  const sample = text.length > MAX_MATCHED_CHARS ? text.slice(0, MAX_MATCHED_CHARS) : text;
  let lineFg: string | undefined;
  let lineBg: string | undefined;
  let lineFound = false;
  const ranges: Range[] = [];

  for (const { rule, regex } of rules) {
    regex.lastIndex = 0;
    if (rule.scope === "line") {
      if (!lineFound && regex.test(sample)) {
        lineFound = true;
        lineFg = rule.fg;
        lineBg = rule.bg ? withAlpha(rule.bg, BACKGROUND_ALPHA) : undefined;
      }
      continue;
    }
    let match: RegExpExecArray | null;
    while ((match = regex.exec(sample)) !== null) {
      if (match[0] === "") {
        regex.lastIndex++; // empty match: avoid looping forever
        continue;
      }
      const start = match.index;
      const end = start + match[0].length;
      if (!overlaps(ranges, start, end)) {
        ranges.push({ start, end, ...(rule.fg ? { fg: rule.fg } : {}), ...(rule.bg ? { bg: withAlpha(rule.bg, BACKGROUND_ALPHA) } : {}) });
      }
    }
  }

  const result: HighlightResult = { segments: [] };
  if (lineFg) result.lineFg = lineFg;
  if (lineBg) result.lineBg = lineBg;
  if (ranges.length === 0) {
    result.segments.push({ text });
    return result;
  }
  ranges.sort((a, b) => a.start - b.start);
  let at = 0;
  for (const range of ranges) {
    if (range.start > at) result.segments.push({ text: text.slice(at, range.start) });
    const segment: Segment = { text: text.slice(range.start, range.end) };
    if (range.fg) segment.fg = range.fg;
    if (range.bg) segment.bg = range.bg;
    result.segments.push(segment);
    at = range.end;
  }
  if (at < text.length) result.segments.push({ text: text.slice(at) });
  return result;
}

/** True when the rule (enabled or not) matches somewhere in `text`; false for an invalid or empty pattern. */
export function ruleMatches(rule: HighlightRule, text: string): boolean {
  const { compiled } = compileRules([{ ...rule, enabled: true }]);
  const first = compiled[0];
  if (!first) return false;
  first.regex.lastIndex = 0;
  return first.regex.test(text.length > MAX_MATCHED_CHARS ? text.slice(0, MAX_MATCHED_CHARS) : text);
}
