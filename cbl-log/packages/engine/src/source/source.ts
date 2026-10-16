// Abstraction de lecture : le reste du moteur ne voit jamais un fd ou un chemin.
// FileSource en P0 ; GzSource / CommandSource / SshSource viendront plus tard.

/** Identite d'un fichier ouvert (ino + dev, en chaine : les index NTFS 64 bits depassent 2^53). */
export interface SourceIdentity {
  ino: string;
  dev: string;
}

export interface ReadOptions {
  /** false : lecture directe, sans passer par ni polluer le cache de blocs (indexation en balayage). */
  cache?: boolean;
}

export interface Source {
  readonly path: string;
  size(): Promise<number>;
  /** Lecture positionnelle. Un buffer plus court que `length` signifie EOF ; jamais d'exception pour un offset >= size. */
  readAt(offset: number, length: number, options?: ReadOptions): Promise<Buffer>;
  identity(): Promise<SourceIdentity>;
  close(): Promise<void>;
}

export type SourceErrorCode = "ENOENT" | "EACCES" | "EISDIR" | "BINARY" | "CLOSED" | "UNKNOWN";

/** Seule erreur que l'API publique du moteur laisse sortir pour les problemes d'I/O. */
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

/** Convertit une erreur Node brute en SourceError typee. */
export function toSourceError(err: unknown, path: string): SourceError {
  if (err instanceof SourceError) return err;
  const errno = (err as NodeJS.ErrnoException | null)?.code;
  const message = err instanceof Error ? err.message : String(err);
  switch (errno) {
    case "ENOENT":
    case "ENOTDIR":
      return new SourceError("ENOENT", path, `Fichier introuvable : ${path}`, { cause: err });
    case "EACCES":
    case "EPERM":
    case "EBUSY":
      return new SourceError("EACCES", path, `Acces refuse : ${path}`, { cause: err });
    case "EISDIR":
      return new SourceError("EISDIR", path, `${path} est un dossier`, { cause: err });
    default:
      return new SourceError("UNKNOWN", path, message, { cause: err });
  }
}
