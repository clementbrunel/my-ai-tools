// Simulated log writer, run in a separate process (child_process.fork) by rolling.test.ts.
// Writes numbered lines "<8-digit seq> <padding>" continuously and rolls the file every `rollBytes`.
//
// Modes: rename | truncate | copytruncate | dated | delete
// Messages to the parent: ready, rolling {n, nextSeq} (syncRoll only; waits for {type:"go"}),
//   error {op, code, message} (a failed rename/unlink/copy: the test fails), done {lastSeq, rolls}.
import { closeSync, copyFileSync, mkdirSync, openSync, renameSync, truncateSync, unlinkSync, writeSync } from "node:fs";
import { join } from "node:path";

const cfg = JSON.parse(process.argv[2]);
const { dir, mode, rollBytes, rolls, syncRoll = false, linesPerBatch = 100, batchDelayMs = 2 } = cfg;
const LINE_PAD = "p".repeat(80);

mkdirSync(dir, { recursive: true });
const livePath = join(dir, mode === "dated" ? "app-0.log" : "app.log");

let goResolve;
process.on("message", (msg) => {
  if (msg && msg.type === "go" && goResolve) goResolve();
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const send = (msg) => process.send(msg);

function fail(op, err) {
  send({ type: "error", op, code: err.code, message: err.message });
  process.exit(1);
}
function attempt(op, fn) {
  try {
    return fn();
  } catch (err) {
    fail(op, err);
  }
}

let fd = attempt("open", () => openSync(livePath, "a"));
let seq = 0;
let bytesInFile = 0;
let rollCount = 0;

function writeBatch() {
  let text = "";
  for (let i = 0; i < linesPerBatch; i++) text += `${String(seq++).padStart(8, "0")} ${LINE_PAD}\n`;
  const buf = Buffer.from(text);
  attempt("write", () => writeSync(fd, buf));
  bytesInFile += buf.length;
}

function roll() {
  const n = ++rollCount;
  const archive = join(dir, `app.log.${n}`);
  switch (mode) {
    case "rename":
      // rename while our own handle is still open: this is what Windows loggers do
      attempt("rename", () => renameSync(livePath, archive));
      closeSync(fd);
      fd = attempt("open", () => openSync(livePath, "a"));
      break;
    case "truncate":
      attempt("truncate", () => truncateSync(livePath, 0));
      break;
    case "copytruncate":
      attempt("copy", () => copyFileSync(livePath, archive));
      attempt("truncate", () => truncateSync(livePath, 0));
      break;
    case "dated":
      closeSync(fd);
      fd = attempt("open", () => openSync(join(dir, `app-${n}.log`), "a"));
      break;
    case "delete":
      closeSync(fd);
      attempt("unlink", () => unlinkSync(livePath));
      fd = attempt("open", () => openSync(livePath, "a"));
      break;
    default:
      fail("mode", new Error(`unknown mode ${mode}`));
  }
  bytesInFile = 0;
}

send({ type: "ready" });
while (rollCount < rolls) {
  writeBatch();
  if (bytesInFile >= rollBytes) {
    if (syncRoll) {
      send({ type: "rolling", n: rollCount + 1, nextSeq: seq });
      await new Promise((r) => (goResolve = r));
    }
    roll();
  }
  await sleep(batchDelayMs);
}
writeBatch(); // final lines in the last file
closeSync(fd);
send({ type: "done", lastSeq: seq - 1, rolls: rollCount });
// give the parent time to read the message before exiting
setTimeout(() => process.exit(0), 50);
