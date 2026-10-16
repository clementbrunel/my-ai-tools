// Checkpoints (offset of the start of line i*64) in a Float64Array: exact up to 2^53.
// 70 M lines => ~1.1 M entries => ~9 MB. The buffer is a growable SharedArrayBuffer so that
// search workers can read it without copying.

const INITIAL_CAPACITY = 1024;
// Address-space reservation only: 1 GiB = 134 M checkpoints = 8.6 billion lines.
const MAX_BYTE_LENGTH = 1024 * 1024 * 1024;

interface GrowableSharedArrayBuffer extends SharedArrayBuffer {
  grow?(newLength: number): void;
  readonly growable?: boolean;
}

type GrowableCtor = new (length: number, options: { maxByteLength: number }) => GrowableSharedArrayBuffer;

export class CheckpointStore {
  private sab: GrowableSharedArrayBuffer;
  private view: Float64Array;
  private used = 0;

  constructor() {
    this.sab = CheckpointStore.allocate(INITIAL_CAPACITY * 8);
    this.view = new Float64Array(this.sab);
  }

  private static allocate(byteLength: number): GrowableSharedArrayBuffer {
    try {
      const sab = new (SharedArrayBuffer as unknown as GrowableCtor)(byteLength, { maxByteLength: MAX_BYTE_LENGTH });
      if (sab.growable) return sab;
    } catch {
      // engine without growable SAB: fall back to fixed allocation + copy
    }
    return new SharedArrayBuffer(byteLength);
  }

  /** Shareable buffer. Note: in the fallback (non-growable SAB) it changes when the store grows. */
  get buffer(): SharedArrayBuffer {
    return this.sab;
  }

  /** Number of checkpoints written. */
  get count(): number {
    return this.used;
  }

  get byteLength(): number {
    return this.sab.byteLength;
  }

  get(index: number): number {
    return this.view[index]!;
  }

  set(index: number, offset: number): void {
    if (index >= this.view.length) this.grow(index + 1);
    this.view[index] = offset;
    if (index >= this.used) this.used = index + 1;
  }

  setMany(firstIndex: number, offsets: Float64Array): void {
    if (offsets.length === 0) return;
    const needed = firstIndex + offsets.length;
    if (needed > this.view.length) this.grow(needed);
    this.view.set(offsets, firstIndex);
    if (needed > this.used) this.used = needed;
  }

  clear(): void {
    this.used = 0;
  }

  private grow(minEntries: number): void {
    let capacity = this.view.length;
    while (capacity < minEntries) capacity *= 2;
    if (this.sab.growable && this.sab.grow) {
      this.sab.grow(capacity * 8);
      this.view = new Float64Array(this.sab);
    } else {
      const next = CheckpointStore.allocate(capacity * 8);
      const nextView = new Float64Array(next);
      nextView.set(this.view.subarray(0, this.used));
      this.sab = next;
      this.view = nextView;
    }
  }
}
