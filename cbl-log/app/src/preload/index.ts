import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { CblLogApi } from "./api";

const api: CblLogApi = {
  version: "0.0.0",
  openFileDialog: () => ipcRenderer.invoke("dialog:open-files") as Promise<string[]>,
  onOpenFiles: (cb) => {
    const listener = (_event: unknown, paths: string[]): void => cb(paths);
    ipcRenderer.on("files:open", listener);
    return () => {
      ipcRenderer.off("files:open", listener);
    };
  },
  getPathForFile: (file) => webUtils.getPathForFile(file),
  notifyReady: () => ipcRenderer.send("renderer:ready"),
  loadRuleSets: () => ipcRenderer.invoke("rules:load") as ReturnType<CblLogApi["loadRuleSets"]>,
  saveRuleSet: (set) => ipcRenderer.invoke("rules:save", set) as Promise<void>,
};

contextBridge.exposeInMainWorld("cblLog", api);

// contextBridge cannot transfer a MessagePort: relay it to the page with window.postMessage.
ipcRenderer.on("engine-port", (event) => {
  window.postMessage({ type: "cbl-log:engine-port" }, "*", event.ports);
});
