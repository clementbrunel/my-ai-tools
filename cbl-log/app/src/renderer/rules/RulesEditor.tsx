import { useEffect } from "react";
import type { HighlightRule } from "@cbl-log/shared";
import { createRule, moveRule, removeRule, updateRule } from "./rules-edit";

interface Props {
  rules: readonly HighlightRule[];
  /** Rule id -> compile error, for rules whose regex is invalid. */
  errors: Record<string, string>;
  onChange(rules: HighlightRule[]): void;
  onReset(): void;
  onClose(): void;
}

/** Modal editor: edits apply to the open tabs immediately; the parent persists them. */
export function RulesEditor({ rules, errors, onChange, onReset, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const patch = (id: string, change: Partial<HighlightRule>): void => onChange(updateRule(rules, id, change));

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal rules-editor" role="dialog" aria-label="Règles de surlignage" onMouseDown={(e) => e.stopPropagation()}>
        <header>
          <h2>Règles de surlignage</h2>
          <button type="button" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </header>
        <p className="hint">La première règle « ligne » qui correspond colore la ligne ; pour les fragments, la règle placée plus haut l'emporte.</p>
        <div className="rules-list">
          {rules.map((rule, index) => (
            <div key={rule.id} className={errors[rule.id] ? "rule-row invalid" : "rule-row"}>
              <input
                type="checkbox"
                checked={rule.enabled}
                onChange={(e) => patch(rule.id, { enabled: e.target.checked })}
                title="Activer / désactiver"
                aria-label="Activée"
              />
              <input
                className="rule-pattern"
                value={rule.pattern}
                placeholder="motif"
                onChange={(e) => patch(rule.id, { pattern: e.target.value })}
                title={errors[rule.id] ?? ""}
                aria-label="Motif"
              />
              <label title="Expression régulière">
                <input type="checkbox" checked={rule.isRegex} onChange={(e) => patch(rule.id, { isRegex: e.target.checked })} /> regex
              </label>
              <label title="Respecter la casse">
                <input type="checkbox" checked={rule.caseSensitive} onChange={(e) => patch(rule.id, { caseSensitive: e.target.checked })} /> Aa
              </label>
              <select value={rule.scope} onChange={(e) => patch(rule.id, { scope: e.target.value as HighlightRule["scope"] })} aria-label="Portée">
                <option value="line">ligne</option>
                <option value="fragment">fragment</option>
              </select>
              <ColorField label="texte" value={rule.fg} onChange={(fg) => patch(rule.id, { fg })} />
              <ColorField label="fond" value={rule.bg} onChange={(bg) => patch(rule.id, { bg })} />
              <button type="button" onClick={() => onChange(moveRule(rules, rule.id, -1))} disabled={index === 0} aria-label="Monter">
                ↑
              </button>
              <button type="button" onClick={() => onChange(moveRule(rules, rule.id, 1))} disabled={index === rules.length - 1} aria-label="Descendre">
                ↓
              </button>
              <button type="button" onClick={() => onChange(removeRule(rules, rule.id))} aria-label="Supprimer">
                🗑
              </button>
              {errors[rule.id] && <span className="rule-error">{errors[rule.id]}</span>}
            </div>
          ))}
        </div>
        <footer>
          <button type="button" onClick={() => onChange([...rules, createRule(rules)])}>
            Ajouter une règle
          </button>
          <button type="button" onClick={onReset}>
            Rétablir les règles par défaut
          </button>
        </footer>
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string | undefined; onChange(value: string | undefined): void }) {
  return (
    <span className="color-field" title={`Couleur du ${label}`}>
      <input type="color" value={value ?? "#808080"} onChange={(e) => onChange(e.target.value)} aria-label={`Couleur du ${label}`} className={value ? "" : "unset"} />
      <button type="button" onClick={() => onChange(undefined)} disabled={!value} aria-label={`Aucune couleur de ${label}`}>
        ∅
      </button>
    </span>
  );
}
