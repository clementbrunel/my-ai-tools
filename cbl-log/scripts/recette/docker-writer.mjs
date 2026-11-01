// Writer run INSIDE a container of the Docker acceptance run (`docker exec … > /proc/1/fd/1`): same lines as the
// bench writer of the file run (packages/engine/bench/writer.ts), but on stdout, so both runs read the same data.
//   node docker-writer.mjs --rate 1000 --seconds 20 [--start-seq 0]
// Each line carries its sequence number and its write time: `[10/14/26 10:02:11:204 CEST] 0000004a SystemOut     O #<seq>#<wallMs>#<padding>`.
const arg = (name, fallback) => {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 ? process.argv[at + 1] : fallback;
};
const rate = Number(arg("rate"));
const seconds = Number(arg("seconds"));
const startSeq = Number(arg("start-seq", "0"));
const total = Math.round(rate * seconds);
const PADDING = "x".repeat(70);
const TICK_MS = 5;

const pad2 = (n) => (n < 10 ? `0${n}` : String(n));
const pad3 = (n) => (n < 10 ? `00${n}` : n < 100 ? `0${n}` : String(n));
/** Same as `formatWebsphereTimestamp` of the bench generator. */
function stamp(epochMs) {
  const d = new Date(epochMs);
  return `[${pad2(d.getUTCMonth() + 1)}/${pad2(d.getUTCDate())}/${pad2(d.getUTCFullYear() % 100)} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}:${pad3(d.getUTCMilliseconds())} CEST]`;
}

const start = performance.now();
let sent = 0;
const tick = () => {
  const elapsed = (performance.now() - start) / 1000;
  const target = elapsed >= seconds ? total : Math.min(total, Math.floor(elapsed * rate));
  if (target > sent) {
    const ts = Date.now();
    const head = stamp(ts);
    let chunk = "";
    for (let seq = sent; seq < target; seq++) chunk += `${head} 0000004a SystemOut     O #${startSeq + seq}#${ts}#${PADDING}\n`;
    process.stdout.write(chunk);
    sent = target;
  }
  if (sent >= total) return;
  setTimeout(tick, TICK_MS);
};
tick();
