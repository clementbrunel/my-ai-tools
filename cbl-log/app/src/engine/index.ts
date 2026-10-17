// utilityProcess entry point: hosts the EngineService and serves the renderer over a MessagePort
// handed over by the main process.
import { join } from "node:path";
import { EngineService, setIndexerWorkerPath, setSearchWorkerPath, type PortLike } from "@cbl-log/engine";

// The indexing worker is a separate bundle entry (see electron.vite.config.ts) next to this file.
setIndexerWorkerPath(join(__dirname, "indexer-worker.js"));
setSearchWorkerPath(join(__dirname, "search-worker.js"));

const service = new EngineService();

/** Adapts an Electron MessagePortMain to the engine's PortLike. */
function adaptMainPort(port: Electron.MessagePortMain): PortLike {
  return {
    postMessage: (msg) => port.postMessage(msg),
    onMessage: (handler) => {
      const listener = (event: Electron.MessageEvent): void => handler(event.data);
      port.on("message", listener);
      return () => {
        port.off("message", listener);
      };
    },
  };
}

process.parentPort.on("message", (event) => {
  const port = event.ports[0];
  if (!port) return;
  const detach = service.attach(adaptMainPort(port));
  port.once("close", detach);
  port.start();
});
