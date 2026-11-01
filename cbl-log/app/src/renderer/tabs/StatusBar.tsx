import type { Encoding, FilterSettings } from "@cbl-log/shared";
import { describeFilterCount } from "../filter/filter-state";
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
  /** The format has continuation lines (stack traces) that can be folded under their record. */
  canFoldTraces: boolean;
  onFilterChange(filter: FilterSettings): void;
  /** Lines that arrived since the view was frozen (undefined = not paused). */
  pendingLines: number | undefined;
  onTogglePause(): void;
  /** The full file is shown although a filter is in force. */
  filterSuspended: boolean;
  /** Levels or text filters are set, so that a filtered view differs from the full file. */
  hasFilter: boolean;
  /** Switches between the filtered view and the full file, keeping the position. */
  onToggleFilterView(): void;
  /** Lines shown by the filter in force (undefined = no filter). */
  filterShown?: { matches: number; done: boolean } | undefined;
  /** Docker tab: status text ("Docker · running depuis 10:02") and the "load more history" action. */
  docker?: { status: string; loading: boolean; onLoadMore(): void } | undefined;
}


export function StatusBar({ tab, onToggleFollow, onClear, onUnclear, onEditRules, dark, onToggleTheme, formatName, profiles, profileChoice, autoProfileName, onProfileChange, onEncodingChange, canFoldTraces, onFilterChange, filterSuspended, hasFilter, onToggleFilterView, pendingLines, onTogglePause, filterShown, docker }: Props) {
  const full = filterSuspended || !hasFilter;
  return (
    <footer className="statusbar">
      <span className="line-count" title="Lignes affichées sur le total">
        {filterShown ? `${describeFilterCount(filterShown.matches, tab.total)}${filterShown.done ? "" : "…"}` : `${tab.total.toLocaleString("fr-FR")} lignes`}
      </span>
      <span className="status-sep" aria-hidden="true" />
      <span className="status-meta">
        {formatBytes(tab.info.sizeBytes)} · <span title="Format de log détecté">{formatName ?? "brut"}</span>
      </span>
      {docker ? (
        <span className="status-file docker-file">
          <span className="status-path docker-status" title={`${tab.docker?.context}/${tab.docker?.name}\nCopie locale : ${tab.info.path}`}>
            {docker.status}
          </span>
          <button type="button" disabled={docker.loading} onClick={docker.onLoadMore} title="Remonter plus loin dans l'historique du conteneur (×10 ; la copie locale est reconstruite)">
            {docker.loading ? "Chargement…" : "Charger plus d'historique"}
          </button>
        </span>
      ) : (
      <span className="status-file">
        <span
          className="status-path"
          title={`${tab.info.path}\nClic droit : ouvrir le dossier`}
          onContextMenu={(e) => {
            e.preventDefault();
            void window.cblLog.showFileContextMenu(tab.info.path);
          }}
        >
          {tab.info.path}
        </span>
        <label className="profile-select" title="Encodage du fichier (le choix rouvre l'onglet et interrompt la recherche en cours)">
          <select value={tab.encodingChoice ?? "auto"} onChange={(e) => onEncodingChange(e.target.value === "auto" ? undefined : (e.target.value as Encoding))} aria-label="Encodage">
            <option value="auto">Auto ({encodingLabel(tab.info.encoding)})</option>
            {ENCODING_LABELS.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label}
              </option>
            ))}
          </select>
        </label>
      </span>
      )}
      {tab.indexing !== undefined && <span>Indexation {Math.round(tab.indexing * 100)} %</span>}
      {!docker && tab.state !== "following" && <span className={`state-${tab.state}`}>{tab.state === "missing" ? "Fichier introuvable" : tab.message ?? "Erreur"}</span>}
      {tab.clearedBefore > 0 && (
        <button type="button" className="icon-btn cleared" onClick={onUnclear} title={`${tab.clearedBefore.toLocaleString("fr-FR")} ligne(s) masquée(s) — cliquer pour tout réafficher`} aria-label="Réafficher les lignes masquées">
          <TrashIcon /> {tab.clearedBefore.toLocaleString("fr-FR")} ✕
        </button>
      )}
      <span className="view-switch" role="group" aria-label="Vue affichée">
        <button
          type="button"
          className={full ? "" : "on"}
          aria-pressed={!full}
          disabled={!hasFilter}
          onClick={full ? onToggleFilterView : undefined}
          title={hasFilter ? "Lignes filtrées uniquement" : "Aucun filtre de niveau ou de texte défini"}
        >
          Filtré
        </button>
        <button
          type="button"
          className={full ? "on" : ""}
          aria-pressed={full}
          onClick={full ? undefined : onToggleFilterView}
          title="Tout le fichier, à la même position (double-clic sur une ligne filtrée : la voir dans son contexte). Les stack traces suivent l'interrupteur « Replier »."
        >
          Fichier complet
        </button>
      </span>
      <label
        className={canFoldTraces ? "fold-toggle" : "fold-toggle disabled"}
        title={canFoldTraces ? "Replier les stack traces : une seule ligne par enregistrement (double-clic pour voir le détail)" : "Repli des stack traces : format de log non reconnu"}
      >
        <input
          type="checkbox"
          role="switch"
          className="switch"
          checked={tab.filter.foldTraces}
          disabled={!canFoldTraces}
          onChange={() => onFilterChange({ ...tab.filter, foldTraces: !tab.filter.foldTraces })}
        />
        Replier les traces
      </label>
      <label className="profile-select" title="Profil de surlignage de cet onglet">
        <select value={profileChoice} onChange={(e) => onProfileChange(e.target.value)} aria-label="Profil de surlignage">
          <option value="auto">Profil : auto ({autoProfileName})</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              Profil : {p.name || p.id}
            </option>
          ))}
        </select>
      </label>
      <span className="status-tools">
        <button type="button" className="icon-btn" onClick={onEditRules} title="Règles de surlignage (Ctrl+H)" aria-label="Règles de surlignage">
          <RulesIcon />
        </button>
        {tab.clearedBefore === 0 && (
          <button type="button" className="icon-btn" onClick={onClear} title="Effacer : masquer tout ce qui précède (Ctrl+L)" aria-label="Effacer">
            <TrashIcon />
          </button>
        )}
        <button type="button" role="switch" aria-checked={dark} className="icon-btn theme-switch" onClick={onToggleTheme} title={dark ? "Thème sombre — passer au thème clair" : "Thème clair — passer au thème sombre"} aria-label="Thème sombre">
          {dark ? <MoonIcon /> : <SunIcon />}
        </button>
      </span>
      <span className="status-live">
        <button
          type="button"
          className={pendingLines !== undefined ? "pause on" : "pause"}
          aria-pressed={pendingLines !== undefined}
          onClick={onTogglePause}
          title={pendingLines !== undefined ? "Reprendre le rafraîchissement (Pause)" : "Figer la vue : les lignes qui arrivent sont gardées, affichées à la reprise (Pause)"}
        >
          <PauseIcon /> {pendingLines !== undefined ? `Pause (+${pendingLines.toLocaleString("fr-FR")})` : "Pause"}
        </button>
        <button type="button" className={tab.follow ? "follow on" : "follow"} aria-pressed={tab.follow} onClick={onToggleFollow} title="Suivre la fin du fichier (Ctrl+End)">
          <FollowIcon /> Suivre
        </button>
      </span>
    </footer>
  );
}

const icon = { width: 14, height: 14, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

function TrashIcon() {
  return (
    <svg {...icon}>
      <path d="M2.5 4.5h11M6 4.5V3h4v1.5M4 4.5l.7 9h6.6l.7-9" />
    </svg>
  );
}

function RulesIcon() {
  return (
    <svg {...icon}>
      <path d="M2.5 4h11M2.5 8h7M2.5 12h9" />
      <circle cx="12.5" cy="8" r="1.5" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg {...icon}>
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg {...icon}>
      <path d="M13 9.5A5.5 5.5 0 1 1 6.5 3a4.5 4.5 0 0 0 6.5 6.5z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg {...icon} width={12} height={12}>
      <path d="M5.5 3.5v9M10.5 3.5v9" strokeWidth={2.2} />
    </svg>
  );
}

function FollowIcon() {
  return (
    <svg {...icon} width={12} height={12}>
      <path d="M8 2.5v9M4 8l4 4 4-4M3.5 14h9" />
    </svg>
  );
}
