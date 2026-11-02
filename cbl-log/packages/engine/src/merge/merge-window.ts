// The window of the "All" tab: opening it over files of several Gio must not mean reading them all. The tab
// starts at a point in time shared by every source, chosen so that the busiest one brings about `windowLines`
// lines, and each source begins at its first line from that time on. Logs are written in time order, so that
// line is found by bisection (a couple dozen single-line reads) instead of by reading the file.
import { parseLine, parseTimestamp } from "@cbl-log/shared";
import type { MergeSource } from "./merged-view.js";

/** Lines read at a time while looking for a record head (a line with a timestamp) from a given line. */
const HEAD_SEARCH_LINES = 64;

/** Timestamp of the first record head at or after `line`, with its line; undefined when there is none before `end`. */
async function headAtOrAfter(source: MergeSource, line: number, end: number): Promise<{ ts: number; line: number } | undefined> {
  const pattern = source.format.format.timestamp!;
  for (let from = line; from < end; from += HEAD_SEARCH_LINES) {
    const texts = await source.read(from, Math.min(HEAD_SEARCH_LINES, end - from));
    if (texts.length === 0) return undefined;
    for (const [index, text] of texts.entries()) {
      const parsed = parseLine(source.format, text);
      const ts = parsed?.ts !== undefined ? parseTimestamp(parsed.ts, pattern, source.timestampOptions) : undefined;
      if (ts !== undefined) return { ts, line: from + index };
    }
  }
  return undefined;
}

/** First line of the source whose record head is at `ts` or later (`end` when there is none). */
async function firstLineFrom(source: MergeSource, ts: number, from: number, end: number): Promise<number> {
  let low = from;
  let high = end;
  let best = end; // the earliest record head known to be at `ts` or later
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const head = await headAtOrAfter(source, mid, high);
    if (!head) high = mid; // only continuation lines from mid on: the answer is before them, or `best`
    else if (head.ts < ts) low = head.line + 1;
    else {
      best = head.line; // the lines between mid and that head only continue an older record
      high = mid;
    }
  }
  return best;
}

export interface MergeWindow {
  /** First line of each source (0 = from its start), in the order of the sources. */
  starts: number[];
  /** No line of any source is left out. */
  complete: boolean;
}

/**
 * Where each source starts so that the merge holds the last `windowLines` lines of the busiest one and, from the
 * same time on, the lines of the others. `windowLines` 0 = the whole history. Sources are read as they are now.
 */
export async function windowStarts(sources: readonly MergeSource[], windowLines: number): Promise<MergeWindow> {
  const totals = sources.map((s) => s.lineCount());
  const all: MergeWindow = { starts: sources.map((s) => s.startLine ?? 0), complete: true };
  if (windowLines <= 0) return all;
  try {
    // the common start: the latest of the times at which each long source has `windowLines` lines left
    let since = Number.NEGATIVE_INFINITY;
    for (const [i, source] of sources.entries()) {
      const first = Math.max(source.startLine ?? 0, totals[i]! - windowLines);
      if (first <= (source.startLine ?? 0)) continue;
      const head = await headAtOrAfter(source, first, totals[i]!);
      if (head) since = Math.max(since, head.ts);
    }
    if (since === Number.NEGATIVE_INFINITY) return all;
    const starts = await Promise.all(sources.map((s, i) => firstLineFrom(s, since, s.startLine ?? 0, totals[i]!)));
    return { starts, complete: starts.every((start, i) => start <= (sources[i]!.startLine ?? 0)) };
  } catch {
    return all; // a source that cannot be read at random: merge it whole
  }
}
