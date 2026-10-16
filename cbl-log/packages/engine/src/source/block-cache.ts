// LRU cache of 64 KB blocks, shared by all sources (NF-08: bounded memory budget).

export const BLOCK_SIZE = 64 * 1024;
export const DEFAULT_CACHE_BUDGET = 64 * 1024 * 1024;

export class BlockCache {
  // Map insertion order doubles as LRU order: the oldest entry comes first.
  private readonly blocks = new Map<string, Buffer>();
  private bytes = 0;
  private budget: number;

  constructor(budgetBytes: number = DEFAULT_CACHE_BUDGET) {
    this.budget = budgetBytes;
  }

  get byteSize(): number {
    return this.bytes;
  }

  get blockCount(): number {
    return this.blocks.size;
  }

  get budgetBytes(): number {
    return this.budget;
  }

  setBudget(budgetBytes: number): void {
    this.budget = budgetBytes;
    this.evict();
  }

  get(sourceId: number, blockIndex: number): Buffer | undefined {
    const key = `${sourceId}:${blockIndex}`;
    const block = this.blocks.get(key);
    if (block) {
      // re-inserting = "recently used"
      this.blocks.delete(key);
      this.blocks.set(key, block);
    }
    return block;
  }

  /** Only store full blocks: a partial block (end of file) could become stale. */
  set(sourceId: number, blockIndex: number, block: Buffer): void {
    const key = `${sourceId}:${blockIndex}`;
    const previous = this.blocks.get(key);
    if (previous) {
      this.bytes -= previous.length;
      this.blocks.delete(key);
    }
    this.blocks.set(key, block);
    this.bytes += block.length;
    this.evict();
  }

  /** Drops every block of a source (truncation, rolling, close). */
  invalidate(sourceId: number): void {
    const prefix = `${sourceId}:`;
    for (const [key, block] of this.blocks) {
      if (key.startsWith(prefix)) {
        this.blocks.delete(key);
        this.bytes -= block.length;
      }
    }
  }

  clear(): void {
    this.blocks.clear();
    this.bytes = 0;
  }

  private evict(): void {
    for (const [key, block] of this.blocks) {
      if (this.bytes <= this.budget) return;
      this.blocks.delete(key);
      this.bytes -= block.length;
    }
  }
}

let globalCache: BlockCache | undefined;

/** Singleton shared by all FileSource instances. */
export function getGlobalBlockCache(): BlockCache {
  globalCache ??= new BlockCache();
  return globalCache;
}
