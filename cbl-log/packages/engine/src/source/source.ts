// Read abstraction: the rest of the engine never sees an fd or a path.
// FileSource in P0; GzSource / CommandSource / SshSource will come later.

/** Identity of an open file (ino + dev, as strings: 64-bit NTFS file indexes exceed 2^53). */
export interface SourceIdentity {
  ino: string;
  dev: string;
}

export interface ReadOptions {
  /** false: direct read, neither using nor polluting the block cache (sweeping indexation). */
  cache?: boolean;
}

export interface Source {
  readonly path: string;
  size(): Promise<number>;
  /** Positional read. A buffer shorter than `length` means EOF; never throws for an offset >= size. */
  readAt(offset: number, length: number, options?: ReadOptions): Promise<Buffer>;
  identity(): Promise<SourceIdentity>;
  close(): Promise<void>;
}

export type SourceErrorCode = "ENOENT" | "EACCES" | "EISDIR" | "BINARY" | "BAD_QUERY" | "CLOSED" | "UNKNOWN";

/** The only error the engine's public API lets out for I/O problems. */
export class SourceError extends Error {
  readonly code: SourceErrorCode;
  readonly path: string;

  constructor(code: SourceErrorCode, path: string, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "SourceError";
    this.code = code;
    this.path = path;
  }
}

/** Converts a raw Node error into a typed SourceError. */
export function toSourceError(err: unknown, path: string): SourceError {
  if (err instanceof SourceError) return err;
  const errno = (err as NodeJS.ErrnoException | null)?.code;
  const message = err instanceof Error ? err.message : String(err);
  switch (errno) {
    case "ENOENT":
    case "ENOTDIR":
      return new SourceError("ENOENT", path, `File not found: ${path}`, { cause: err });
    case "EACCES":
    case "EPERM":
    case "EBUSY":
      return new SourceError("EACCES", path, `Access denied: ${path}`, { cause: err });
    case "EISDIR":
      return new SourceError("EISDIR", path, `${path} is a directory`, { cause: err });
    default:
      return new SourceError("UNKNOWN", path, message, { cause: err });
  }
}
