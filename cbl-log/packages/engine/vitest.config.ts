import { defineConfig } from "vitest/config";

// Several tests start worker threads or follow files in real time: on a loaded (or slow Windows CI)
// machine the 5 s default is too tight and only ever produced spurious failures.
export default defineConfig({
  test: { testTimeout: 30_000, hookTimeout: 30_000 },
});
