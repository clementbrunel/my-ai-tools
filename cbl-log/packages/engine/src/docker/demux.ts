import { Transform, type TransformCallback } from "node:stream";

export type LogStreamKind = "stdout" | "stderr";

const HEADER = 8;

/**
 * Demultiplexes Docker's log stream (containers without a TTY): frames of
 * `[stream, 0, 0, 0, size uint32 BE]` followed by `size` bytes. Chunks may split frames anywhere.
 * Output is the payload bytes in order; `onFrame` (optional) also learns which stream each came from.
 * Stream 0 (stdin) is treated as stdout.
 */
export class LogDemuxer extends Transform {
  private pending: Buffer = Buffer.alloc(0);
  private remaining = 0;
  private kind: LogStreamKind = "stdout";

  constructor(private readonly onFrame?: (kind: LogStreamKind, payload: Buffer) => void) {
    super();
  }

  override _transform(chunk: Buffer, _enc: BufferEncoding, cb: TransformCallback): void {
    const buf = this.pending.length > 0 ? Buffer.concat([this.pending, chunk]) : chunk;
    this.pending = Buffer.alloc(0);
    let pos = 0;
    while (pos < buf.length) {
      if (this.remaining === 0) {
        if (buf.length - pos < HEADER) break;
        this.kind = buf[pos] === 2 ? "stderr" : "stdout";
        this.remaining = buf.readUInt32BE(pos + 4);
        pos += HEADER;
        continue; // size 0 = empty frame, loops straight to the next header
      }
      const take = Math.min(this.remaining, buf.length - pos);
      const payload = buf.subarray(pos, pos + take);
      this.onFrame?.(this.kind, payload);
      this.push(payload);
      this.remaining -= take;
      pos += take;
    }
    if (pos < buf.length) this.pending = Buffer.from(buf.subarray(pos));
    cb();
  }

  override _flush(cb: TransformCallback): void {
    // A stream cut mid-frame (daemon restart, abort) just loses its unfinished tail.
    cb();
  }
}
