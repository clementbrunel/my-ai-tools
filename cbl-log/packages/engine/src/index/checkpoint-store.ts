// Points de controle (offset du debut de la ligne i*64) dans un Float64Array : exact jusqu'a 2^53.
// 70 M lignes => ~1,1 M entrees => ~9 Mo. Le tampon est un SharedArrayBuffer extensible pour que
// des workers de recherche puissent le lire sans copie.

const INITIAL_CAPACITY = 1024;
// Reservation d'espace d'adressage uniquement : 1 Gio = 134 M points = 8,6 milliards de lignes.
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
      // moteur sans SAB extensible : repli sur allocation fixe + copie
    }
    return new SharedArrayBuffer(byteLength);
  }

  /** Tampon partageable. Attention : en repli (SAB non extensible) il change quand le magasin grandit. */
  get buffer(): SharedArrayBuffer {
    return this.sab;
  }

  /** Nombre de points de controle ecrits. */
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
