import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

// Workspace packages are ESM: bundle them instead of externalizing them.
const bundled = ["@cbl-log/shared", "@cbl-log/engine"];

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: bundled })],
    build: {
      rollupOptions: {
        // engine.js = utilityProcess entry; indexer-worker.js must sit next to it (worker_threads
        // loads it by path, see setIndexerWorkerPath in src/engine/index.ts).
        input: {
          index: resolve(__dirname, "src/main/index.ts"),
          engine: resolve(__dirname, "src/engine/index.ts"),
          "indexer-worker": resolve(__dirname, "../packages/engine/src/index/indexer-worker.ts"),
        },
        output: { entryFileNames: "[name].js" },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: bundled })],
    build: { rollupOptions: { input: resolve(__dirname, "src/preload/index.ts") } },
  },
  renderer: {
    root: resolve(__dirname, "src/renderer"),
    plugins: [react()],
    build: { rollupOptions: { input: resolve(__dirname, "src/renderer/index.html") } },
  },
});
