// Entry point of a filter worker (see filter-host.ts): reads one byte range of a file, made of whole
// lines, evaluates the filter on each line and posts the numbers (and levels) of the retained ones.
import { open } from "node:fs/promises";
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

async function run(job: FilterJob): Promise<void> {
  const handle = await open(job.path, "r");
  try {
    const evaluator = new FilterEvaluator(job.filter, job.format ? compileFormat(job.format) : undefined);
    const decoder = createDecoder(job.encoding);

    let lines: number[] = [];
    let levels: number[] = [];
    let lastPost = Date.now();
    const flush = (): void => {
      if (lines.length === 0) return;
      const l = Uint32Array.from(lines);
      const v = Uint8Array.from(levels);
      lines = [];
      levels = [];
      post({ type: "lines", lines: l, levels: v }, [l.buffer, v.buffer]);
      lastPost = Date.now();
    };

    const carry: ScanCarry = { pendingCR: false };
    let readSize = job.chunkSize;
    let pos = job.warmupOffset;
    let lineNo = job.warmupLine;
    while (pos < job.end) {
      const buf = Buffer.allocUnsafe(Math.min(readSize, job.end - pos));
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
      if (starts.length === 0 && consumed > 0 && pos + bytesRead < job.end) {
        readSize *= 2; // a single line larger than the chunk: read more
        continue;
      }
      readSize = job.chunkSize;
      // the last line may lack a terminator (end of the range is a line start, so only at EOF)
      if (pos + bytesRead >= job.end && lineStart < job.end) {
        starts.push(lineStart);
        // a lone CR ending the range is the terminator of the last line
        ends.push(carry.pendingCR ? job.end - (isUtf16(job.encoding) ? 2 : 1) : job.end);
        lineStart = job.end;
      }

      for (let i = 0; i < starts.length; i++, lineNo++) {
        const text = decoder.decode(chunk.subarray(starts[i]! - pos, ends[i]! - pos));
        if (starts[i]! < job.start) {
          evaluator.skip(text);
          continue;
        }
        const verdict = evaluator.test(text);
        if (verdict.keep) {
          lines.push(lineNo);
          levels.push(levelCode(verdict.level));
        }
      }

      pos = lineStart;
      if (lines.length >= BATCH_LINES || Date.now() - lastPost >= BATCH_INTERVAL_MS) flush();
      post({ type: "progress", bytes: pos - job.warmupOffset });
      if (consumed === 0) break;
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
