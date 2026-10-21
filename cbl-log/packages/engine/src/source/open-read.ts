import { constants } from "node:fs";
import { open, type FileHandle } from "node:fs/promises";
import { isUncPath } from "../tail/poll-scheduler.js";

/**
 * Opens `path` read-only. On a UNC path the handle is opened with O_SYNC (FILE_FLAG_WRITE_THROUGH):
 * a plain long-lived read handle makes the SMB client cache the file, after which the active log
 * stops updating for every reader on the machine (BareTail included) until the handle is closed.
 * A write-through open keeps the client from caching. Measured with a bare Node script.
 */
export function openReadOnly(path: string): Promise<FileHandle> {
  return isUncPath(path) ? open(path, constants.O_RDONLY | constants.O_SYNC) : open(path, "r");
}
