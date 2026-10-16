import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

// Les paquets workspace sont en ESM : on les embarque dans le bundle au lieu de les externaliser.
const bundled = ["@cbl-log/shared", "@cbl-log/engine"];

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: bundled })],
    build: { rollupOptions: { input: resolve(__dirname, "src/main/index.ts") } },
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
