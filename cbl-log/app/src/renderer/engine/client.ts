import { RpcClient, type MinimalPort } from "./rpc-client";

function adaptDomPort(port: MessagePort): MinimalPort {
  return {
    postMessage: (msg) => port.postMessage(msg),
    onMessage: (handler) => {
      const listener = (e: MessageEvent): void => handler(e.data);
      port.addEventListener("message", listener);
      port.start();
      return () => port.removeEventListener("message", listener);
    },
  };
}

type EngineListener = (client: RpcClient, isReconnection: boolean) => void;

let current: RpcClient | undefined;
const listeners = new Set<EngineListener>();
let resolveFirst: (client: RpcClient) => void;

/** Resolves with the first engine connection. */
export const engineReady: Promise<RpcClient> = new Promise((resolve) => {
  resolveFirst = resolve;
});

/**
 * Calls `listener` with the current engine client (if any) and with each new one: the main process
 * hands the renderer a fresh port after an engine restart, and the old client is then disposed.
 */
export function subscribeEngine(listener: EngineListener): () => void {
  listeners.add(listener);
  if (current) listener(current, false);
  return () => listeners.delete(listener);
}

// Installed when this module is imported, so the port cannot be missed whatever the mounting order.
// The port is relayed by the preload with window.postMessage (contextBridge cannot transfer ports).
window.addEventListener("message", (e: MessageEvent) => {
  if (e.source !== window || e.data?.type !== "cbl-log:engine-port") return;
  const port = e.ports[0];
  if (!port) return;
  const previous = current;
  previous?.dispose();
  const client = new RpcClient(adaptDomPort(port));
  current = client;
  if (!previous) resolveFirst(client);
  for (const listener of [...listeners]) listener(client, previous !== undefined);
});
