import { parseLine, parseTimestamp, type CompiledFormat } from "@cbl-log/shared";

/** Outcome of "go to a time": the 1-based line of the file to show (with a remark), or why it failed. */
export type GotoTimeResult = { line: number; note?: string } | { error: string };

/** A time typed by the user: a full date, or a time of day (the date is then the one of the log). */
export type GotoTarget = { kind: "date"; ms: number } | { kind: "time"; msOfDay: number };

const MS_PER_DAY = 86_400_000;

function clock(h: string, m: string, s = "0", frac = "0"): number | undefined {
  const hour = Number(h);
  const minute = Number(m);
  const second = Number(s);
  if (hour > 23 || minute > 59 || second > 59) return undefined;
  return ((hour * 60 + minute) * 60 + second) * 1000 + Math.round(Number(`0.${frac}`) * 1000);
}

/**
 * Reads what the user typed in "go to": `HH:mm[:ss[.SSS]]`, `yyyy-MM-dd HH:mm[:ss[.SSS]]` (or with a `T`)
 * or `dd/MM/yyyy HH:mm[:ss[.SSS]]`. The result is a wall-clock value, to compare with `wallClockOf`.
 */
export function parseGotoInput(text: string): GotoTarget | undefined {
  const input = text.trim();
  const time = /^(\d{1,2}):(\d{2})(?::(\d{2})(?:[.,:](\d{1,3}))?)?$/.exec(input);
  if (time) {
    const msOfDay = clock(time[1]!, time[2]!, time[3], time[4]);
    return msOfDay === undefined ? undefined : { kind: "time", msOfDay };
  }
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:[.,:](\d{1,3}))?)?$/.exec(input);
  const dmy = iso ? null : /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2})(?::(\d{2})(?:[.,:](\d{1,3}))?)?$/.exec(input);
  const date = iso ?? dmy;
  if (!date) return undefined;
  const year = Number(iso ? date[1] : date[3]);
  const month = Number(date[2]);
  const day = Number(iso ? date[3] : date[1]);
  const msOfDay = clock(date[4]!, date[5]!, date[6], date[7]);
  if (msOfDay === undefined || month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  return { kind: "date", ms: Date.UTC(year, month - 1, day) + msOfDay };
}

/** Wall-clock time (ms, as if UTC) of the first record head found in `texts`, undefined when none has a timestamp. */
export function wallClockOf(compiled: CompiledFormat, texts: readonly string[]): number | undefined {
  const pattern = compiled.format.timestamp;
  if (!pattern) return undefined;
  for (const text of texts) {
    const ts = parseLine(compiled, text)?.ts;
    const ms = ts === undefined ? undefined : parseTimestamp(ts, pattern, { ignoreZone: true });
    if (ms !== undefined) return ms;
  }
  return undefined;
}

/** Wall-clock target: a time of day takes the date of `reference` (a wall-clock value of the log). */
export function resolveTarget(target: GotoTarget, reference: number): number {
  return target.kind === "date" ? target.ms : Math.floor(reference / MS_PER_DAY) * MS_PER_DAY + target.msOfDay;
}

export interface TimeSearch {
  /** Rows [first, first+count) of the file as text; shorter at the end. */
  readTexts(first: number, count: number): Promise<string[]>;
  compiled: CompiledFormat;
  /** Rows [from, to) are searched (`from` is the first row not cleared, `to` the row count). */
  from: number;
  to: number;
}

/** Rows read to find the next record head when the probed row is a continuation line. */
const PROBE_ROWS = 64;

/**
 * First row whose record is at or after `wallMs` (log assumed chronological), by bisection on the
 * rows: about log2(rows) small reads. `row === to` when every record is earlier; `before` is set when
 * the target is earlier than the first record; `after` when it is later than the last one.
 */
export async function findRowAtTime(search: TimeSearch, wallMs: number): Promise<{ row: number; before: boolean; after: boolean }> {
  const { from, to } = search;
  const probe = async (row: number): Promise<number | undefined> => wallClockOf(search.compiled, await search.readTexts(row, Math.min(PROBE_ROWS, to - row)));
  let low = from;
  let high = to;
  while (low < high) {
    const mid = (low + high) >> 1;
    const ms = await probe(mid);
    // a stretch without any timestamp (long stack trace): treat it as not before the target, keep going left
    if (ms !== undefined && ms < wallMs) low = mid + 1;
    else high = mid;
  }
  // `low` can be a continuation line of an earlier record: the answer is the next record head
  if (low < to) {
    const texts = await search.readTexts(low, Math.min(PROBE_ROWS, to - low));
    const head = texts.findIndex((text) => parseLine(search.compiled, text) !== undefined);
    if (head > 0) low += head;
  }
  const first = to > from ? await probe(from) : undefined;
  return { row: low, before: first !== undefined && wallMs < first, after: low >= to };
}
