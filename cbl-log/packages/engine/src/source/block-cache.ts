// Cache LRU de blocs de 64 Ko, global a toutes les sources (NF-08 : budget memoire borne).

export const BLOCK_SIZE = 64 * 1024;
export const DEFAULT_CACHE_BUDGET = 64 * 1024 * 1024;

export class BlockCache {
  // L'ordre d'insertion de Map sert d'ordre LRU : le plus ancien est en tete.
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
      // re-insertion = "recemment utilise"
      this.blocks.delete(key);
      this.blocks.set(key, block);
    }
    return block;
  }

  /** Ne stocker que des blocs complets : un bloc partiel (fin de fichier) pourrait devenir obsolete. */
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

  /** Oublie tous les blocs d'une source (troncature, rolling, fermeture). */
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

/** Singleton partage par toutes les FileSource. */
export function getGlobalBlockCache(): BlockCache {
  globalCache ??= new BlockCache();
  return globalCache;
}
