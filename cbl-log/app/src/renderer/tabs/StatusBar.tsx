import type { TabState } from "./tabs-reducer";

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  const units = ["Ko", "Mo", "Go", "To"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unit]}`;
}

interface Props {
  tab: TabState;
  onToggleFollow(): void;
}

export function StatusBar({ tab, onToggleFollow }: Props) {
  return (
    <footer className="statusbar">
      <span className="status-path" title={tab.info.path}>
        {tab.info.path}
      </span>
      <span>{tab.info.encoding}</span>
      <span>{formatBytes(tab.info.sizeBytes)}</span>
      <span>{tab.total.toLocaleString("fr-FR")} lignes</span>
      {tab.indexing !== undefined && <span>Indexation {Math.round(tab.indexing * 100)} %</span>}
      {tab.state !== "following" && <span className={`state-${tab.state}`}>{tab.state === "missing" ? "Fichier introuvable" : tab.message ?? "Erreur"}</span>}
      <button type="button" className={tab.follow ? "follow on" : "follow"} onClick={onToggleFollow} title="Suivre la fin du fichier (Ctrl+End)">
        FOLLOW
      </button>
    </footer>
  );
}
