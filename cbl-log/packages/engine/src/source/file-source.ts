import { open, type FileHandle } from "node:fs/promises";
import { BLOCK_SIZE, getGlobalBlockCache, type BlockCache } from "./block-cache.js";
import { SourceError, toSourceError, type ReadOptions, type Source, type SourceIdentity } from "./source.js";

let nextSourceId = 1;

export interface FileSourceOptions {
  cache?: BlockCache;
}

/**
 * Read-only, positional (FileHandle.read): never readFile / createReadStream.
 * On Windows libuv opens with FILE_SHARE_READ|WRITE|DELETE, so the log writer can
 * rename or delete the file while we hold it open (tested in file-source.test.ts).
 */
export class FileSource implements Source {
  readonly path: string;
  /** Identifier in the block cache. */
  readonly id: number;
  private handle: FileHandle | undefined;
  private readonly cache: BlockCache;

  private constructor(path: string, handle: FileHandle, cache: BlockCache) {
    this.path = path;
    this.handle = handle;
    this.cache = cache;
    this.id = nextSourceId++;
  }

  static async open(path: string, options: FileSourceOptions = {}): Promise<FileSource> {
    let handle: FileHandle;
    try {
      handle = await open(path, "r");
    } catch (err) {
      throw toSourceError(err, path);
    }
    try {
      // open() succeeds on a directory on Linux; we explicitly refuse it everywhere.
      if ((await handle.stat()).isDirectory()) throw new SourceError("EISDIR", path, `${path} is a directory`);
    } catch (err) {
      await handle.close().catch(() => {});
      throw toSourceError(err, path);
    }
    return new FileSource(path, handle, options.cache ?? getGlobalBlockCache());
  }

  private requireHandle(): FileHandle {
    if (!this.handle) throw new SourceError("CLOSED", this.path, `Source closed: ${this.path}`);
    return this.handle;
  }

  async size(): Promise<number> {
    try {
      return (await this.requireHandle().stat()).size;
    } catch (err) {
      throw toSourceError(err, this.path);
    }
  }

  async identity(): Promise<SourceIdentity> {
    try {
      // bigint: the NTFS file index is 64 bits and would be truncated as a number
      const st = await this.requireHandle().stat({ bigint: true });
      return { ino: st.ino.toString(), dev: st.dev.toString() };
    } catch (err) {
      throw toSourceError(err, this.path);
    }
  }

  async readAt(offset: number, length: number, options: ReadOptions = {}): Promise<Buffer> {
    if (!(offset >= 0) || !(length > 0)) return Buffer.alloc(0);
    const handle = this.requireHandle();
    try {
      if (options.cache === false) return await this.readDirect(handle, offset, length);
      return await this.readCached(handle, offset, length);
    } catch (err) {
      throw toSourceError(err, this.path);
    }
  }

  /**
   * Swaps the OS handle for a fresh one on the same path. On an SMB share the client caches the
   * attributes (size) of an open handle, so a file written from elsewhere looks frozen until the
   * handle is closed; a new open fetches them again. The cached blocks stay valid (append-only).
   * If the path is gone or replaced, the old handle is kept and the caller's identity check handles it.
   */
  async reopen(): Promise<void> {
    const old = this.requireHandle();
    let fresh: FileHandle;
    try {
      fresh = await open(this.path, "r");
    } catch {
      return;
    }
    this.handle = fresh;
    await old.close().catch(() => {});
  }

  /** Forgets the cached blocks (truncation / rolling detected by the caller). */
  invalidate(): void {
    this.cache.invalidate(this.id);
  }

  async close(): Promise<void> {
    const handle = this.handle;
    if (!handle) return;
    this.handle = undefined;
    this.cache.invalidate(this.id);
    try {
      await handle.close();
    } catch (err) {
      throw toSourceError(err, this.path);
    }
  }

  private async readDirect(handle: FileHandle, offset: number, length: number): Promise<Buffer> {
    const buf = Buffer.allocUnsafe(length);
    let filled = 0;
    while (filled < length) {
      const { bytesRead } = await handle.read(buf, filled, length - filled, offset + filled);
      if (bytesRead === 0) break;
      filled += bytesRead;
    }
    return filled === length ? buf : buf.subarray(0, filled);
  }

  private async readCached(handle: FileHandle, offset: number, length: number): Promise<Buffer> {
    const end = offset + length;
    const firstBlock = Math.floor(offset / BLOCK_SIZE);
    const lastBlock = Math.floor((end - 1) / BLOCK_SIZE);
    const parts: Buffer[] = [];
    for (let index = firstBlock; index <= lastBlock; index++) {
      let block = this.cache.get(this.id, index);
      if (!block) {
        block = await this.readDirect(handle, index * BLOCK_SIZE, BLOCK_SIZE);
        // Partial block = end of file that may still grow: never cached,
        // otherwise we would serve a stale tail after an append.
        if (block.length === BLOCK_SIZE) this.cache.set(this.id, index, block);
      }
      const blockStart = index * BLOCK_SIZE;
      const from = Math.max(offset - blockStart, 0);
      const to = Math.min(end - blockStart, block.length);
      if (to > from) parts.push(block.subarray(from, to));
      if (block.length < BLOCK_SIZE) break; // EOF
    }
    // copy: never expose a cache sub-buffer to the caller
    return parts.length === 1 ? Buffer.from(parts[0]!) : Buffer.concat(parts);
  }
}
