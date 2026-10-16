/// <reference types="vite/client" />
import type { CblLogApi } from "../preload/api";

declare global {
  interface Window {
    cblLog: CblLogApi;
  }
}

export {};
