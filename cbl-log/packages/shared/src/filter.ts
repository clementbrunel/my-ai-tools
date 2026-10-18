// Line filters (S-02, S-03): which lines of a file are shown. A filter is a set of levels plus include
// and exclude texts; the engine evaluates it in worker threads (one line at a time, in file order) and
// the renderer reuses the same evaluator to describe it. Texts are matched line by line, like the
// search; levels follow the record: a continuation line (stack frame, wrapped SQL) has the level of
// the record head above it.
import { LEVELS, parseLine, type CompiledFormat, type Level } from "./formats.js";
import { patternSource, type PatternSpec } from "./pattern.js";

/** One text of an include / exclude list (same fields as a search). */
export interface TextMatcher extends PatternSpec {
  caseSensitive: boolean;
}

export interface LineFilter {
  /**
   * Levels shown. Absent = no restriction. When set, lines without a level (environment banner,
   * lines before the first record) are hidden.
   */
  levels?: readonly Level[] | undefined;
  /** A line must match at least one of them (OR). Empty / absent = no restriction. */
  include?: readonly TextMatcher[] | undefined;
  /** A line matching any of them is hidden (OR). */
  exclude?: readonly TextMatcher[] | undefined;
}

/** Level of a row as carried between the engine and the renderer: 0 = none, 1.. = LEVELS index + 1. */
export function levelCode(level: Level | undefined): number {
  return level === undefined ? 0 : LEVELS.indexOf(level) + 1;
}

export function levelFromCode(code: number): Level | undefined {
  return code > 0 ? LEVELS[code - 1] : undefined;
}

/** A filter that hides nothing is the same as no filter. */
export function isFilterActive(filter: LineFilter | null | undefined): filter is LineFilter {
  if (!filter) return false;
  return filter.levels !== undefined || (filter.include?.length ?? 0) > 0 || (filter.exclude?.length ?? 0) > 0;
}

/** How many lines before a slice the engine reads to learn the level a continuation line inherits. */
export const FILTER_LOOKBACK_LINES = 200;

export interface FilterVerdict {
  keep: boolean;
  /** Level of the line (own or inherited). */
  level: Level | undefined;
}

/**
 * Evaluates a filter on consecutive lines of a file. Stateful: it carries the level of the last record
 * head, so lines must be fed in file order (call `skip` for lines that only warm the state up).
 */
export class FilterEvaluator {
  private readonly levels: ReadonlySet<Level> | undefined;
  private readonly include: RegExp[];
  private readonly exclude: RegExp[];
  private readonly inherits: boolean;
  private carried: Level | undefined;

  /** Throws when a text is not a valid regular expression. */
  constructor(
    filter: LineFilter,
    private readonly format: CompiledFormat | undefined,
  ) {
    this.levels = filter.levels ? new Set(filter.levels) : undefined;
    const compile = (m: TextMatcher): RegExp => new RegExp(patternSource(m), m.caseSensitive ? "" : "i");
    this.include = (filter.include ?? []).map(compile);
    this.exclude = (filter.exclude ?? []).map(compile);
    this.inherits = format?.format.continuation === "not-line";
  }

  /** Feeds a line that is only used to learn the current record level. */
  skip(text: string): void {
    this.levelOf(text);
  }

  test(text: string): FilterVerdict {
    const level = this.levelOf(text);
    if (this.levels && (level === undefined || !this.levels.has(level))) return { keep: false, level };
    for (const re of this.exclude) if (re.test(text)) return { keep: false, level };
    if (this.include.length > 0 && !this.include.some((re) => re.test(text))) return { keep: false, level };
    return { keep: true, level };
  }

  private levelOf(text: string): Level | undefined {
    if (!this.format) return undefined;
    const parsed = parseLine(this.format, text);
    if (parsed) {
      this.carried = parsed.level;
      return parsed.level;
    }
    return this.inherits ? this.carried : undefined;
  }
}

// -------------------------------------------------------------------------------------------------
// What the user edits (UI side)

/** Filter as edited in the interface: `levels` are the CHECKED levels (all of them = unrestricted). */
export interface FilterSettings {
  levels: readonly Level[];
  include: readonly TextMatcher[];
  exclude: readonly TextMatcher[];
}

export const defaultFilterSettings = (): FilterSettings => ({ levels: LEVELS, include: [], exclude: [] });

/** The engine filter for these settings, or null when nothing is hidden. `hasFormat`: levels are known. */
export function toLineFilter(settings: FilterSettings | undefined, hasFormat: boolean): LineFilter | null {
  if (!settings) return null;
  const restricted = hasFormat && settings.levels.length < LEVELS.length;
  const filter: LineFilter = {
    ...(restricted ? { levels: LEVELS.filter((l) => settings.levels.includes(l)) } : {}),
    ...(settings.include.length > 0 ? { include: settings.include } : {}),
    ...(settings.exclude.length > 0 ? { exclude: settings.exclude } : {}),
  };
  return isFilterActive(filter) ? filter : null;
}

/** Same matcher (the pattern with its options)? */
export function sameMatcher(a: TextMatcher, b: TextMatcher): boolean {
  return a.pattern === b.pattern && a.isRegex === b.isRegex && a.caseSensitive === b.caseSensitive && !!a.wholeWord === !!b.wholeWord;
}
