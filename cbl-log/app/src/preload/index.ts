import { contextBridge } from "electron";
import type { CblLogApi } from "./api";

const api: CblLogApi = { version: "0.0.0" };

contextBridge.exposeInMainWorld("cblLog", api);
