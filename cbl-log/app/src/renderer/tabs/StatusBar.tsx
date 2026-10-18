import type { Encoding, Level } from "@cbl-log/shared";
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

const ENCODING_LABELS: readonly { value: Encoding; label: string }[] = [
  { value: "utf-8", label: "UTF-8" },
  { value: "utf-16le", label: "UTF-16 LE" },
  { value: "utf-16be", label: "UTF-16 BE" },
  { value: "windows-1252", label: "Windows-1252" },
  { value: "iso-8859-1", label: "ISO-8859-1" },
];
const encodingLabel = (encoding: Encoding): string => ENCODING_LABELS.find((e) => e.value === encoding)?.label ?? encoding;

interface Props {
  tab: TabState;
  onToggleFollow(): void;
  onClear(): void;
  onUnclear(): void;
  onEditRules(): void;
  /** Dark theme in force (starts from the system setting, then the user's choice). */
  dark: boolean;
  onToggleTheme(): void;
  /** Highlighting profiles: the user's choice for this tab ("auto" = follow the detected format). */
  profiles: readonly { id: string; name: string }[];
  profileChoice: string;
  autoProfileName: string;
  onProfileChange(choice: string): void;
  /** Name of the detected format (undefined = raw). */
  formatName?: string | undefined;
  /** Level of the first visible line. */
  level?: Level | undefined;
  /** Forces an encoding (the tab is reopened); undefined = detect again. */
  onEncodingChange(encoding: Encoding | undefined): void;
}

export function StatusBar({ tab, onToggleFollow, onClear, onUnclear, onEditRules, dark, onToggleTheme, formatName, level, profiles, profileChoice, autoProfileName, onProfileChange, onEncodingChange }: Props) {
  return (
    <footer className="statusbar">
      <span className="status-path" title={tab.info.path}>
        {tab.info.path}
      </span>
      <label className="profile-select" title="Encodage du fichier (le choix rouvre l'onglet et interrompt la recherche en cours)">
        <select value={tab.encodingChoice ?? "auto"} onChange={(e) => onEncodingChange(e.target.value === "auto" ? undefined : (e.target.value as Encoding))}>
          <option value="auto">Auto ({encodingLabel(tab.info.encoding)})</option>
          {ENCODING_LABELS.map((e) => (
            <option key={e.value} value={e.value}>
              {e.label}
            </option>
          ))}
        </select>
      </label>
      <span title="Format de log détecté">{formatName ?? "brut"}</span>
      {level && <span title="Niveau de la dernière ligne affichée" className={`level-badge lvl-text-${level}`}>{level.toUpperCase()}</span>}
      <span>{formatBytes(tab.info.sizeBytes)}</span>
      <span>{tab.total.toLocaleString("fr-FR")} lignes</span>
      {tab.indexing !== undefined && <span>Indexation {Math.round(tab.indexing * 100)} %</span>}
      {tab.state !== "following" && <span className={`state-${tab.state}`}>{tab.state === "missing" ? "Fichier introuvable" : tab.message ?? "Erreur"}</span>}
      {tab.clearedBefore > 0 ? (
        <button type="button" className="link" onClick={onUnclear} title="Réafficher les lignes masquées">
          {tab.clearedBefore.toLocaleString("fr-FR")} ligne(s) masquée(s) — tout afficher
        </button>
      ) : (
        <button type="button" className="link" onClick={onClear} title="Masquer tout ce qui précède (Ctrl+L)">
          Effacer
        </button>
      )}
      <button type="button" role="switch" aria-checked={dark} className={dark ? "theme-switch dark" : "theme-switch"} onClick={onToggleTheme} title="Basculer entre le thème clair et le thème sombre">
        <span className="knob" aria-hidden="true" />
        {dark ? "Sombre" : "Clair"}
      </button>
      <label className="profile-select" title="Profil de surlignage de cet onglet">
        Profil :{" "}
        <select value={profileChoice} onChange={(e) => onProfileChange(e.target.value)}>
          <option value="auto">Auto ({autoProfileName})</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name || p.id}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="link" onClick={onEditRules} title="Règles de surlignage (Ctrl+H)">
        Règles…
      </button>
      <button type="button" className={tab.follow ? "follow on" : "follow"} onClick={onToggleFollow} title="Suivre la fin du fichier (Ctrl+End)">
        FOLLOW
      </button>
    </footer>
  );
}
