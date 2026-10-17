// How a user pattern (search field, highlighting rule) becomes a JavaScript regular expression. Shared
// by the engine (search workers) and the renderer (highlighting) so that both read it the same way.

export interface PatternSpec {
  pattern: string;
  /** false: `pattern` is literal text. */
  isRegex: boolean;
  /** Match whole words only: not preceded and not followed by a letter, digit or underscore. */
  wholeWord?: boolean | undefined;
}

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Source of the regular expression for a pattern. "Whole word" uses look-arounds instead of `\b`, so
 * that it also works for patterns that start or end with a symbol (`[ERROR]`, `.log`) and for
 * alternatives (`ERROR|WARN` is wrapped as one group).
 */
export function patternSource({ pattern, isRegex, wholeWord }: PatternSpec): string {
  const body = isRegex ? pattern : escapeRegExp(pattern);
  return wholeWord ? `(?<!\\w)(?:${body})(?!\\w)` : body;
}
