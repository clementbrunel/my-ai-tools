import type { Encoding, FilterSettings } from "@cbl-log/shared";
import { describeFilterCount, LEVEL_PILLS, pillActive, togglePill } from "../filter/filter-state";
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
  /** Forces an encoding (the tab is reopened); undefined = detect again. */
  onEncodingChange(encoding: Encoding | undefined): void;
  /** Levels can only be told apart in a file whose format is known. */
  canFilterLevels: boolean;
  onFilterChange(filter: FilterSettings): void;
  /** The filter bar (texts to include / exclude) can be hidden; the filter stays in force. */
  filterBarOpen: boolean;
  onToggleFilterBar(): void;
  /** Lines that arrived since the view was frozen (undefined = not paused). */
  pendingLines: number | undefined;
  onTogglePause(): void;
  /** The full file is shown although a filter is in force. */
  filterSuspended: boolean;
  /** Switches between the filtered view and the full file, keeping the position. */
  onToggleFilterView(): void;
  /** Lines shown by the filter in force (undefined = no filter). */
  filterShown?: { matches: number; done: boolean } | undefined;
}

export function StatusBar({ tab, onToggleFollow, onClear, onUnclear, onEditRules, dark, onToggleTheme, formatName, profiles, profileChoice, autoProfileName, onProfileChange, onEncodingChange, canFilterLevels, onFilterChange, filterBarOpen, onToggleFilterBar, filterSuspended, onToggleFilterView, pendingLines, onTogglePause, filterShown }: Props) {
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
      <span>{formatBytes(tab.info.sizeBytes)}</span>
      <button
        type="button"
        className={filterBarOpen ? "link filter-toggle on" : "link filter-toggle"}
        aria-pressed={filterBarOpen}
        onClick={onToggleFilterBar}
        title={filterBarOpen ? "Masquer la barre de filtre (le filtre reste actif) — Ctrl+Maj+F" : "Afficher la barre de filtre — Ctrl+Maj+F"}
      >
        Filtre{tab.filter.include.length + tab.filter.exclude.length > 0 ? ` (${tab.filter.include.length + tab.filter.exclude.length})` : ""}
      </button>
      <span className="level-pills" role="group" aria-label="Niveaux affichés" title={canFilterLevels ? "Niveaux affichés (les lignes de suite suivent leur enregistrement)" : "Filtre par niveau : format de log non reconnu"}>
        {LEVEL_PILLS.map((pill) => {
          const on = pillActive(tab.filter.levels, pill);
          return (
            <button
              key={pill.id}
              type="button"
              role="checkbox"
              aria-checked={on}
              disabled={!canFilterLevels}
              className={`level-pill lvl-text-${pill.levels[pill.levels.length - 1]}${on ? " on" : ""}`}
              onClick={() => onFilterChange({ ...tab.filter, levels: togglePill(tab.filter.levels, pill) })}
            >
              {pill.label}
            </button>
          );
        })}
      </span>
      {tab.filterId && (
        <button
          type="button"
          className="link"
          onClick={onToggleFilterView}
          title={filterSuspended ? "Revenir aux lignes filtrées, à la même position" : "Afficher tout le fichier, à la même position (double-clic sur une ligne : la voir dans son contexte)"}
        >
          {filterSuspended ? "Revenir au filtre" : "Voir tout le fichier"}
        </button>
      )}
      <span>{filterShown ? `${describeFilterCount(filterShown.matches, tab.total)}${filterShown.done ? "" : "…"}` : `${tab.total.toLocaleString("fr-FR")} lignes`}</span>
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
      <button
        type="button"
        className={pendingLines !== undefined ? "pause on" : "pause"}
        aria-pressed={pendingLines !== undefined}
        onClick={onTogglePause}
        title={pendingLines !== undefined ? "Reprendre le rafraîchissement (Pause)" : "Figer la vue : les lignes qui arrivent sont gardées, affichées à la reprise (Pause)"}
      >
        {pendingLines !== undefined ? `PAUSE (+${pendingLines.toLocaleString("fr-FR")})` : "PAUSE"}
      </button>
      <button type="button" className={tab.follow ? "follow on" : "follow"} onClick={onToggleFollow} title="Suivre la fin du fichier (Ctrl+End)">
        FOLLOW
      </button>
    </footer>
  );
}
