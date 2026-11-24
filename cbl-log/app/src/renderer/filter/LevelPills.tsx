import "./LevelPills.css";
import type { FilterSettings } from "@cbl-log/shared";
import { LEVEL_PILLS, pillActive, togglePill } from "./filter-state";
import { t } from "@cbl-log/shared";

interface Props {
  filter: FilterSettings;
  /** Levels can only be told apart in a file whose format is known. */
  enabled: boolean;
  onChange(filter: FilterSettings): void;
}

/** Level toggles of the command bar: a level switched off hides its lines (continuation lines follow their record). */
export function LevelPills({ filter, enabled, onChange }: Props) {
  return (
    <span
      className="level-pills"
      role="group"
      aria-label={t("Niveaux affichés")}
      title={enabled ? t("Niveaux affichés (les lignes de suite suivent leur enregistrement)") : t("Filtre par niveau : format de log non reconnu")}
    >
      {LEVEL_PILLS.map((pill) => {
        const on = pillActive(filter.levels, pill);
        return (
          <button
            key={pill.id}
            type="button"
            role="checkbox"
            aria-checked={on}
            disabled={!enabled}
            className={`level-pill lvl-${pill.levels[pill.levels.length - 1]}${on ? " on" : ""}`}
            onClick={() => onChange({ ...filter, levels: togglePill(filter.levels, pill) })}
          >
            <span className="level-dot" aria-hidden="true" />
            {pill.label}
          </button>
        );
      })}
    </span>
  );
}
