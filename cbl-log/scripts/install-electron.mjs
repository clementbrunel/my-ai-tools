// Electron no longer downloads its binary at install time: fetch it after `npm ci` / `npm install`
// so that `npm run dev` works right away. Skipped in CI (typecheck, tests and build do not need
// the binary); the Electron installer itself is a no-op when the binary is already present.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

if (process.env.CI || process.env.CBL_SKIP_ELECTRON_DOWNLOAD) process.exit(0);

let installer;
try {
  installer = join(dirname(createRequire(import.meta.url).resolve("electron/package.json")), "install.js");
} catch {
  process.exit(0); // electron not installed (e.g. --omit=dev): nothing to do
}

const result = spawnSync(process.execPath, [installer], { stdio: "inherit" });
if (result.status !== 0) {
  // A failed download must not break the install; `npm run dev` will report the missing binary.
  console.warn("[cbl-log] Electron binary download failed; retry with: node node_modules/electron/install.js");
}
