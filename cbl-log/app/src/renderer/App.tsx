import { useEffect } from "react";
import { engineReady } from "./engine/client";

export function App() {
  useEffect(() => {
    void engineReady.then((engine) => {
      console.log("engine connected");
      // Dev-only handle to drive the engine from DevTools: await __engine.request("open", { path })
      if (import.meta.env.DEV) (window as unknown as { __engine: unknown }).__engine = engine;
    });
  }, []);

  return (
    <main className="placeholder">
      <h1>cbl-log</h1>
      <p>Visualiseur de logs temps réel - v{window.cblLog?.version ?? "?"}</p>
    </main>
  );
}
