// Simulated log writer, run as a SEPARATE process so that its load does not skew the tailer's event loop.
// Each line carries its sequence number and its write time: `... O #<seq>#<wallMs>#<padding>`.
// Usage: node writer.js --files a.log,b.log --rate 1000 --seconds 10
import { closeSync, openSync, writeSync } from "node:fs";
import { formatWebsphereTimestamp } from "./generator.js";
import { wallMs } from "./util.js";

const PADDING = "x".repeat(70);
const TICK_MS = 5;

function arg(name: string): string {
  const at = process.argv.indexOf(`--${name}`);
  const value = at >= 0 ? process.argv[at + 1] : undefined;
  if (value === undefined) throw new Error(`Missing --${name}`);
  return value;
}

function main(): void {
  const files = arg("files").split(",");
  const rate = Number(arg("rate"));
  const seconds = Number(arg("seconds"));
  const total = Math.round(rate * seconds);
  const fds = files.map((f) => openSync(f, "a"));
  const start = performance.now();
  let sent = 0;

  const tick = (): void => {
    const elapsed = (performance.now() - start) / 1000;
    const target = elapsed >= seconds ? total : Math.min(total, Math.floor(elapsed * rate));
    if (target > sent) {
      const now = wallMs();
      const stamp = formatWebsphereTimestamp(now);
      const ts = Math.floor(now);
      let chunk = "";
      for (let seq = sent; seq < target; seq++) chunk += `${stamp} 0000004a SystemOut     O #${seq}#${ts}#${PADDING}\n`;
      const data = Buffer.from(chunk, "latin1");
      for (const fd of fds) writeSync(fd, data);
      sent = target;
    }
    if (sent >= total) {
      for (const fd of fds) closeSync(fd);
      process.send?.({ type: "done", written: sent }, () => process.exit(0));
      return;
    }
    setTimeout(tick, TICK_MS);
  };
  process.send?.({ type: "ready" });
  tick();
}

// Only runs when forked by the bench with an IPC channel.
if (process.send) main();
