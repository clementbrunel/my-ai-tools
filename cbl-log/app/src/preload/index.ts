import { contextBridge, ipcRenderer } from "electron";
import type { CblLogApi } from "./api";

const api: CblLogApi = { version: "0.0.0" };

contextBridge.exposeInMainWorld("cblLog", api);

// contextBridge cannot transfer a MessagePort: relay it to the page with window.postMessage.
ipcRenderer.on("engine-port", (event) => {
  window.postMessage({ type: "cbl-log:engine-port" }, "*", event.ports);
});
