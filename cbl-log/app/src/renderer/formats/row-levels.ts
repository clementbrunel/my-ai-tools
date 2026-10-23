import { parseLine, type CompiledFormat, type Level } from "@cbl-log/shared";

/** How far back to look for the record a continuation line belongs to. */
export const MAX_LOOKBACK_ROWS = 200;

/**
 * Level of each row in [first, first+count): a record line has the level of its own header; with
 * `continuation: "not-line"`, a line that is not a record head (stack frame, wrapped SQL, ...) takes
 * the level of the record above it. `textOf` returns undefined for rows that are not loaded.
 * For the first rows the record head may be above the window: it is searched in `textOf` backwards.
 */
export function computeRowLevels(
  compiled: CompiledFormat | undefined,
  textOf: (row: number) => string | undefined,
  first: number,
  count: number,
): (Level | undefined)[] {
  const out: (Level | undefined)[] = [];
  if (!compiled || count <= 0) return out;
  const inherits = compiled.format.continuation === "not-line";

  let carried: Level | undefined;
  if (inherits) {
    for (let row = first, steps = 0; row >= 0 && steps <= MAX_LOOKBACK_ROWS; row--, steps++) {
      const text = textOf(row);
      if (text === undefined) break; // not loaded: unknown
      const parsed = parseLine(compiled, text);
      if (parsed) {
        carried = parsed.level;
        break;
      }
    }
  }
  for (let row = first; row < first + count; row++) {
    const text = textOf(row);
    const parsed = text === undefined ? undefined : parseLine(compiled, text);
    if (parsed) carried = parsed.level;
    out.push(parsed ? parsed.level : inherits && text !== undefined ? carried : undefined);
  }
  return out;
}
