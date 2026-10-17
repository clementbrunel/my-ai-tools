// Helpers of the acceptance run (issue #393): launch the packaged app, drive it over the Chrome
// DevTools Protocol and measure it from the outside (process memory, frame times, DOM).
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const now = () => performance.now();

export function tempDir(prefix) {
  return mkdtempSync(join(tmpdir(), `cbl-log-recette-${prefix}-`));
}

function appEnv(userData) {
  const env = { ...process.env, CBL_LOG_USER_DATA: userData };
  delete env.ELECTRON_RUN_AS_NODE; // set by some harnesses: it would start Electron as plain Node
  return env;
}

async function connectCdp(port, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let target;
  while (!target) {
    if (Date.now() > deadline) throw new Error(`No DevTools page on port ${port}`);
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      target = list.find((t) => t.type === "page");
    } catch {
      // not listening yet
    }
    if (!target) await sleep(200);
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    pending.get(d.id)?.(d);
  };
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const i = ++id;
      pending.set(i, resolve);
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  const ev = async (expression, awaitPromise = false) => {
    const res = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise });
    if (res.result?.exceptionDetails) throw new Error(`page error: ${res.result.exceptionDetails.text} ${res.result.exceptionDetails.exception?.description ?? ""}`);
    return res.result?.result?.value;
  };
  const key = async (k, code, modifiers = 0, vk) => {
    for (const type of ["keyDown", "keyUp"]) {
      await send("Input.dispatchKeyEvent", { type, key: k, code, modifiers, windowsVirtualKeyCode: vk ?? k.toUpperCase().charCodeAt(0) });
    }
  };
  return { send, ev, key, close: () => ws.close() };
}

/** Starts the packaged app (first instance) with an isolated config folder. */
export async function launch({ exe, args = [], userData, port }) {
  const proc = spawn(exe, [`--remote-debugging-port=${port}`, ...args], { env: appEnv(userData), stdio: "ignore" });
  const cdp = await connectCdp(port);
  await waitFor(() => cdp.ev("!!document.querySelector('.placeholder, .tabs')"), "app ready", 30_000);
  return { proc, cdp, exe, userData };
}

/** Opens files in the running app the way a user double-click would (second instance, forwarded). */
export function openInRunningApp(app, files) {
  return spawn(app.exe, files, { env: appEnv(app.userData), stdio: "ignore" });
}

/** Closes the window like the user does (so that the session is saved), then waits for the exit. */
export async function quit(app, { graceful = true } = {}) {
  if (graceful) {
    await app.cdp.send("Browser.close").catch(() => {});
    await Promise.race([new Promise((r) => app.proc.once("exit", r)), sleep(8000)]);
  }
  app.cdp.close();
  if (app.proc.exitCode === null) app.proc.kill();
  await sleep(500);
}

export async function waitFor(condition, what, timeoutMs = 20_000, stepMs = 50) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await condition();
    if (value) return value;
    if (Date.now() > deadline) throw new Error(`Timed out (${timeoutMs} ms): ${what}`);
    await sleep(stepMs);
  }
}

/** Memory of every cbl-log process (browser, GPU, renderer, engine), in MiB. */
export function memory() {
  const script =
    "Get-CimInstance Win32_PerfFormattedData_PerfProc_Process | Where-Object { $_.Name -like 'cbl-log*' } | ForEach-Object { '{0} {1}' -f $_.WorkingSetPrivate, $_.WorkingSet }";
  const out = execFileSync("powershell", ["-NoProfile", "-Command", script], { encoding: "utf8" });
  let privateBytes = 0;
  let workingSet = 0;
  let processes = 0;
  for (const line of out.split(/\r?\n/).filter(Boolean)) {
    const [p, w] = line.trim().split(/\s+/).map(Number);
    privateBytes += p || 0;
    workingSet += w || 0;
    processes++;
  }
  const mib = (n) => Math.round(n / 1048576);
  return { privateMiB: mib(privateBytes), workingSetMiB: mib(workingSet), processes };
}

export const percentile = (values, p) => {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
};

/** Page-side snippets. */
export const page = {
  /** Number of lines shown in the status bar (digits only: the thousands separator is a narrow space). */
  totalLines: `(() => { const s = [...document.querySelectorAll('.statusbar > span')].find((e) => /lignes/.test(e.innerText)); return s ? Number(s.innerText.replace(/\\D/g, '')) : null; })()`,
  rowCount: `document.querySelectorAll('.log-row').length`,
  /** Frame-time and last-line sampler; read it back with `page.stopSampler`. */
  startSampler: `(() => {
    window.__s = { dt: [], lat: [], lastSeq: -1, stop: false };
    let last = performance.now();
    const loop = () => { const n = performance.now(); window.__s.dt.push(n - last); last = n; if (!window.__s.stop) requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    window.__s.timer = setInterval(() => {
      const rows = document.querySelectorAll('.log-row'); const row = rows[rows.length - 1]; if (!row) return;
      const m = /#(\\d+)#(\\d+)#/.exec(row.querySelector('.log-text').innerText);
      if (m) { window.__s.lastSeq = Math.max(window.__s.lastSeq, Number(m[1])); window.__s.lat.push(Date.now() - Number(m[2])); }
    }, 100);
  })()`,
  stopSampler: `(() => { window.__s.stop = true; clearInterval(window.__s.timer); return JSON.stringify(window.__s); })()`,
};
