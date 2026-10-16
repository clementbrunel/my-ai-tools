// cbl-log engine: plain Node TypeScript, no dependency on Electron.
export const ENGINE_NAME = "@cbl-log/engine";

export function engineInfo(): { name: string } {
  return { name: ENGINE_NAME };
}

export * from "./source/index.js";

export * from "./index/index.js";

export * from "./tail/index.js";

export * from "./service/index.js";
