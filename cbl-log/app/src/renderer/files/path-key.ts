/** Comparison key for "is this file already open": Windows paths are case-insensitive. */
export function pathKey(path: string): string {
  return path.replace(/\//g, "\\").toLowerCase();
}

/** Last path segment, for compact messages and tab titles. */
export function baseName(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}
