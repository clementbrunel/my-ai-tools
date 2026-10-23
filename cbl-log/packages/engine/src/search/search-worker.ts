// Entry point of a search worker (see search-host.ts): scans one byte range of a file, made of whole
// lines, and posts the offsets of the lines that match. Depends only on the pure line scanner.
import { open } from "node:fs/promises";
import { parentPort, workerData } from "node:worker_threads";
import { patternSource } from "@cbl-log/shared";
import { createDecoder, isUtf16 } from "../source/encoding.js";
import { scanChunk, type ScanCarry } from "../index/scan.js";
import type { SearchJob, SearchWorkerMessage } from "./search-types.js";

const port = parentPort;
if (!port) throw new Error("search-worker must run inside a worker_thread");

const BATCH_MATCHES = 20_000;
const BATCH_INTERVAL_MS = 100;

function post(msg: SearchWorkerMessage, transfer: ArrayBuffer[] = []): void {
  port!.postMessage(msg, transfer);
}

/** Bytes of a literal that can be searched in the raw buffer without decoding, if possible. */
function rawNeedle(job: SearchJob): Buffer | undefined {
  const { pattern, isRegex, caseSensitive, wholeWord } = job.query;
  if (isRegex || wholeWord || !caseSensitive || pattern === "" || /[\r\n]/.test(pattern)) return undefined;
  if (job.encoding === "utf-8") return Buffer.from(pattern, "utf8");
  if (!isUtf16(job.encoding) && /^[\x20-\x7e]*$/.test(pattern)) return Buffer.from(pattern, "latin1");
  return undefined;
}

async function run(job: SearchJob): Promise<void> {
  const handle = await open(job.path, "r");
  try {
    const needle = rawNeedle(job);
    const regex = needle
      ? undefined
      : new RegExp(patternSource(job.query), job.query.caseSensitive ? "" : "i");
    const decoder = createDecoder(job.encoding);

    let batch: number[] = [];
    let lastPost = Date.now();
    const flush = (): void => {
      if (batch.length === 0) return;
      const offsets = Float64Array.from(batch);
      batch = [];
      post({ type: "matches", offsets }, [offsets.buffer]);
      lastPost = Date.now();
    };

    const carry: ScanCarry = { pendingCR: false };
    let readSize = job.chunkSize;
    let pos = job.start;
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

      if (needle) {
        let line = 0;
        let from = 0;
        for (;;) {
          const hit = chunk.indexOf(needle, from);
          if (hit === -1) break;
          const abs = pos + hit;
          while (line < starts.length - 1 && starts[line + 1]! <= abs) line++;
          if (line >= starts.length || abs >= ends[line]!) {
            // hit inside a terminator or past the last complete line: look further
            from = hit + 1;
            if (line >= starts.length) break;
            continue;
          }
          if (abs + needle.length <= ends[line]!) batch.push(starts[line]!);
          // next candidate: the following line
          const nextStart = starts[line + 1];
          if (nextStart === undefined) break;
          from = nextStart - pos;
        }
      } else {
        for (let i = 0; i < starts.length; i++) {
          const text = decoder.decode(chunk.subarray(starts[i]! - pos, ends[i]! - pos));
          if (regex!.test(text)) batch.push(starts[i]!);
        }
      }

      pos = lineStart;
      if (batch.length >= BATCH_MATCHES || Date.now() - lastPost >= BATCH_INTERVAL_MS) flush();
      post({ type: "progress", bytes: pos - job.start });
      if (consumed === 0) break;
    }
    flush();
    post({ type: "done" });
  } finally {
    await handle.close();
  }
}

run(workerData as SearchJob).catch((err: unknown) => {
  const e = err as NodeJS.ErrnoException;
  post({ type: "error", code: e?.code ?? "UNKNOWN", message: e?.message ?? String(err) });
});
