// Entry point of a filter worker (see filter-host.ts): reads one byte range of a file, made of whole
// lines, evaluates the filter on each line and posts the numbers (and levels) of the retained ones.
// When continuation lines are folded, it also counts those hidden under each retained record head,
// reading past the end of its range until the next head.
import type { FileHandle } from "node:fs/promises";
import { openReadOnly } from "../source/open-read.js";
import { parentPort, workerData } from "node:worker_threads";
import { FilterEvaluator, compileFormat, levelCode } from "@cbl-log/shared";
import { createDecoder, isUtf16 } from "../source/encoding.js";
import { scanChunk, type ScanCarry } from "../index/scan.js";
import type { FilterJob, FilterWorkerMessage } from "./filter-types.js";

const port = parentPort;
if (!port) throw new Error("filter-worker must run inside a worker_thread");

const BATCH_LINES = 50_000;
const BATCH_INTERVAL_MS = 100;

function post(msg: FilterWorkerMessage, transfer: ArrayBuffer[] = []): void {
  port!.postMessage(msg, transfer);
}

/**
 * Calls `onLine` for each line of [from, to) (both line starts), with its start offset and text, until
 * `onLine` returns true. `onChunk` is called after each chunk with the offset reached.
 */
async function readLines(
  handle: FileHandle,
  job: FilterJob,
  from: number,
  to: number,
  onLine: (start: number, text: string) => boolean | void,
  onChunk?: (pos: number) => void,
): Promise<void> {
  const decoder = createDecoder(job.encoding);
  const carry: ScanCarry = { pendingCR: false };
  let readSize = job.chunkSize;
  let pos = from;
  while (pos < to) {
    const buf = Buffer.allocUnsafe(Math.min(readSize, to - pos));
    const { bytesRead } = await handle.read(buf, 0, buf.length, pos);
    if (bytesRead === 0) break;
    const chunk = buf.subarray(0, bytesRead);
    carry.pendingCR = false; // every read restarts at a line start

    // whole lines of this chunk: [starts[i], ends[i]) without the terminator
    const starts: number[] = [];
    const ends: number[] = [];
    let lineStart = pos;
    const consumed = scanChunk(chunk, pos, job.encoding, carry, (next, term) => {
      starts.push(lineStart);
      ends.push(next - term);
      lineStart = next;
    });
    if (starts.length === 0 && consumed > 0 && pos + bytesRead < to) {
      readSize *= 2; // a single line larger than the chunk: read more
      continue;
    }
    readSize = job.chunkSize;
    // the last line may lack a terminator (end of the range is a line start, so only at EOF)
    if (pos + bytesRead >= to && lineStart < to) {
      starts.push(lineStart);
      // a lone CR ending the range is the terminator of the last line
      ends.push(carry.pendingCR ? to - (isUtf16(job.encoding) ? 2 : 1) : to);
      lineStart = to;
    }

    for (let i = 0; i < starts.length; i++) {
      const text = decoder.decode(chunk.subarray(starts[i]! - pos, ends[i]! - pos));
      if (onLine(starts[i]!, text) === true) return;
    }

    pos = lineStart;
    onChunk?.(pos);
    if (consumed === 0) break;
  }
}

async function run(job: FilterJob): Promise<void> {
  const handle = await openReadOnly(job.path);
  try {
    const evaluator = new FilterEvaluator(job.filter, job.format ? compileFormat(job.format) : undefined);
    const fold = !!job.filter.foldContinuation;

    let lines: number[] = [];
    let levels: number[] = [];
    let folds: number[] = [];
    /** Index (in the batch) of the retained head whose continuation lines are being counted, or -1. */
    let pending = -1;
    let lastPost = Date.now();
    const flush = (): void => {
      if (lines.length === 0) return;
      const l = Uint32Array.from(lines);
      const v = Uint8Array.from(levels);
      const f = Uint32Array.from(folds);
      lines = [];
      levels = [];
      folds = [];
      pending = -1;
      post({ type: "lines", lines: l, levels: v, folds: f }, [l.buffer, v.buffer, f.buffer]);
      lastPost = Date.now();
    };

    let lineNo = job.warmupLine;
    /** Start of the last line that was retained, for the session to rescan an unfinished record. */
    let lastKeptLine = -1;
    let lastKeptOffset = 0;
    await readLines(
      handle,
      job,
      job.warmupOffset,
      job.end,
      (start, text) => {
        const line = lineNo++;
        if (start < job.start) {
          evaluator.skip(text);
          return;
        }
        const verdict = evaluator.test(text);
        if (verdict.folded) {
          if (pending >= 0) folds[pending]!++;
          return;
        }
        if (verdict.keep) {
          lines.push(line);
          levels.push(levelCode(verdict.level));
          folds.push(0);
          pending = fold ? lines.length - 1 : -1;
          lastKeptLine = line;
          lastKeptOffset = start;
        } else {
          pending = -1;
        }
      },
      (pos) => {
        // a batch is only sent once the record being counted is complete
        if (pending < 0 && (lines.length >= BATCH_LINES || Date.now() - lastPost >= BATCH_INTERVAL_MS)) flush();
        post({ type: "progress", bytes: pos - job.warmupOffset });
      },
    );

    // The last retained head may continue past the end of the range: count up to the next head.
    if (fold && pending >= 0 && job.end < job.limit) {
      let reachedHead = false;
      await readLines(
        handle,
        job,
        job.end,
        job.limit,
        (_start, text) => {
          if (!evaluator.continues(text)) {
            reachedHead = true;
            return true;
          }
          folds[pending]!++;
        },
        () => post({ type: "progress", bytes: 0 }),
      );
      // the record runs up to the end of what is indexed: it may still be growing
      if (!reachedHead && lastKeptLine >= 0) post({ type: "tail", line: lastKeptLine, offset: lastKeptOffset });
    } else if (fold && pending >= 0 && lastKeptLine >= 0) {
      post({ type: "tail", line: lastKeptLine, offset: lastKeptOffset });
    }
    flush();
    post({ type: "done" });
  } finally {
    await handle.close();
  }
}

run(workerData as FilterJob).catch((err: unknown) => {
  const e = err as NodeJS.ErrnoException;
  post({ type: "error", code: e?.code ?? "UNKNOWN", message: e?.message ?? String(err) });
});
