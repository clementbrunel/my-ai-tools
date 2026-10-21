// Diagnostic for a log that freezes on a UNC share while cbl-log is open.
// Usage: node scripts/diag-unc.mjs "\\server1\share\SystemOut.log" [default|sync|reopen]
//   default : one long-lived read handle (what cbl-log does)
//   sync    : same, opened with O_SYNC (FILE_FLAG_WRITE_THROUGH)
//   reopen  : a fresh handle on every tick
// Every 2 s prints: size by path (stat), size by handle (fstat), and the last bytes readable.
// Run it alone, then next to BareTail, and say whether BareTail freezes while this runs.
import { constants } from "node:fs";
import { open, stat } from "node:fs/promises";

const [path, mode = "default"] = process.argv.slice(2);
if (!path) {
  console.error('usage: node scripts/diag-unc.mjs "<path>" [default|sync|reopen]');
  process.exit(1);
}
const flags = mode === "sync" ? constants.O_RDONLY | constants.O_SYNC : constants.O_RDONLY;
let handle = await open(path, flags);

for (;;) {
  if (mode === "reopen") {
    await handle.close();
    handle = await open(path, flags);
  }
  const byPath = (await stat(path)).size;
  const byHandle = (await handle.stat()).size;
  const len = Math.min(120, byHandle);
  const buf = Buffer.alloc(len);
  const { bytesRead } = await handle.read(buf, 0, len, byHandle - len);
  const tail = buf.subarray(0, bytesRead).toString("latin1").replace(/\s+/g, " ").slice(-80);
  console.log(`${new Date().toTimeString().slice(0, 8)} path=${byPath} handle=${byHandle} tail="${tail}"`);
  await new Promise((r) => setTimeout(r, 2000));
}
