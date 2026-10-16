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

/**
 * Waits for the port the main process transfers (relayed by the preload with window.postMessage)
 * and wraps it in an RpcClient. The listener is installed when this module is imported, so the
 * port cannot be missed whatever the React mounting order.
 */
export const engineReady: Promise<RpcClient> = new Promise((resolve) => {
  const onMessage = (e: MessageEvent): void => {
    if (e.source !== window || e.data?.type !== "cbl-log:engine-port") return;
    const port = e.ports[0];
    if (!port) return;
    window.removeEventListener("message", onMessage);
    resolve(new RpcClient(adaptDomPort(port)));
  };
  window.addEventListener("message", onMessage);
});
