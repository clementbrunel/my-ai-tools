export function App() {
  return (
    <main className="placeholder">
      <h1>cbl-log</h1>
      <p>Visualiseur de logs temps réel - v{window.cblLog?.version ?? "?"}</p>
    </main>
  );
}
