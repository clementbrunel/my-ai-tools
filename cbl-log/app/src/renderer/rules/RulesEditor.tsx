import { useEffect, useRef, useState } from "react";
import type { HighlightRule, RuleSet } from "@cbl-log/shared";
import { compileRules, highlightLine, ruleMatches } from "../highlight/highlight";
import { RegexHelp } from "../search/RegexHelp";
import { insertAt } from "../search/regex-help";
import { createRule, moveRuleTo, removeRule, updateRule } from "./rules-edit";

interface Props {
  /** Profiles, the tab's choice ("auto" or an id) and what "auto" means for this tab: the editor edits the tab's profile. */
  sets: readonly RuleSet[];
  selectedId: string;
  choice: string;
  autoName: string;
  onChoose(choice: string): void;
  /** Log formats a profile can be proposed for. */
  formatOptions: readonly { id: string; name: string }[];
  onToggleFormat(formatId: string): void;
  onCreate(name: string): void;
  rules: readonly HighlightRule[];
  /** Rule id -> compile error, for rules whose regex is invalid. */
  errors: Record<string, string>;
  onChange(rules: HighlightRule[]): void;
  onReset(): void;
  onClose(): void;
}

/** Modal editor: edits apply to the open tabs immediately; the parent persists them. */
export function RulesEditor({ sets, selectedId, choice, autoName, onChoose, formatOptions, onToggleFormat, onCreate, rules, errors, onChange, onReset, onClose }: Props) {
  const selected = sets.find((s) => s.id === selectedId);
  const [naming, setNaming] = useState(false);
  const [newName, setNewName] = useState("");
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const patch = (id: string, change: Partial<HighlightRule>): void => onChange(updateRule(rules, id, change));

  // one help panel at a time, under the rule being edited; `sample` lets people try their rules
  const [helpFor, setHelpFor] = useState<string | undefined>();
  const [sample, setSample] = useState("");
  const patternInputs = useRef(new Map<string, HTMLInputElement>());
  const pendingCursor = useRef<{ id: string; cursor: number } | undefined>(undefined);
  useEffect(() => {
    const pending = pendingCursor.current;
    if (!pending) return;
    pendingCursor.current = undefined;
    const input = patternInputs.current.get(pending.id);
    input?.focus();
    input?.setSelectionRange(pending.cursor, pending.cursor);
  });
  const insertInto = (rule: HighlightRule, text: string): void => {
    const input = patternInputs.current.get(rule.id);
    const done = insertAt(rule.pattern, input?.selectionStart ?? rule.pattern.length, input?.selectionEnd ?? rule.pattern.length, text);
    pendingCursor.current = { id: rule.id, cursor: done.cursor };
    patch(rule.id, { pattern: done.value, isRegex: true });
  };
  // drag & drop reordering: only the grip starts a drag (so text fields stay selectable)
  const [dragId, setDragId] = useState<string | undefined>();
  const [overId, setOverId] = useState<string | undefined>();
  const endDrag = (): void => {
    setDragId(undefined);
    setOverId(undefined);
  };
  const dragIndex = rules.findIndex((r) => r.id === dragId);
  const overIndex = rules.findIndex((r) => r.id === overId);
  const dropClass = (id: string, index: number): string => {
    if (dragId === undefined || overId !== id || id === dragId) return "";
    return index > dragIndex ? " drop-after" : " drop-before";
  };
  const preview = sample === "" ? undefined : highlightLine(sample, compileRules(rules).compiled);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal rules-editor" role="dialog" aria-label="Règles de surlignage" onMouseDown={(e) => e.stopPropagation()}>
        <header>
          <h2>Règles de surlignage</h2>
          <button type="button" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </header>
        <div className="profile-bar">
          <label title="Même réglage que « Profil » dans la barre d'état : c'est le profil de l'onglet affiché">
            Profil de cet onglet
            <select value={choice} onChange={(ev) => onChoose(ev.target.value)}>
              <option value="auto">Auto ({autoName})</option>
              {sets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name || s.id}
                </option>
              ))}
            </select>
          </label>
          {naming ? (
            <form
              className="profile-new"
              onSubmit={(ev) => {
                ev.preventDefault();
                if (newName.trim()) onCreate(newName.trim());
                setNaming(false);
                setNewName("");
              }}
            >
              <input autoFocus value={newName} onChange={(ev) => setNewName(ev.target.value)} placeholder="Nom du nouveau profil" onKeyDown={(ev) => ev.key === "Escape" && setNaming(false)} />
              <button type="submit">Créer</button>
            </form>
          ) : (
            <button type="button" onClick={() => setNaming(true)} title="Crée un profil à partir des règles affichées">
              Nouveau profil…
            </button>
          )}
          <span className="profile-formats">
            Proposé automatiquement pour les logs :{" "}
            {formatOptions.map((f) => (
              <label key={f.id}>
                <input type="checkbox" checked={selected?.formats.includes(f.id) ?? false} onChange={() => onToggleFormat(f.id)} /> {f.name}
              </label>
            ))}
          </span>
        </div>
        <p className="hint">Les règles ci-dessous sont celles du profil <strong>{selected?.name || selectedId}</strong>, appliqué à l'onglet affiché. La première règle « ligne » qui correspond colore la ligne ; pour les fragments, la règle placée plus haut l'emporte.</p>
        <div className="rules-sample">
          <label>
            Ligne d'exemple (collez une vraie ligne de log pour voir ce que vos règles en font)
            <input value={sample} onChange={(e) => setSample(e.target.value)} placeholder="2026-10-18 10:02:11 ERROR something failed" />
          </label>
          {preview && (
            <div className="sample-preview" style={{ backgroundColor: preview.lineBg, color: preview.lineFg }}>
              {preview.segments.map((seg, n) => (
                <span key={n} style={{ backgroundColor: seg.bg, color: seg.fg }}>
                  {seg.text}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="rules-list">
          {rules.map((rule, index) => (
            <div
              key={rule.id}
              className={`rule-row${errors[rule.id] ? " invalid" : ""}${dragId === rule.id ? " dragging" : ""}${dropClass(rule.id, index)}`}
              onDragOver={(e) => {
                if (dragId === undefined) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (overId !== rule.id) setOverId(rule.id);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId !== undefined && overIndex !== -1 && dragId !== rule.id) onChange(moveRuleTo(rules, dragId, index));
                endDrag();
              }}
            >
              <span
                className="rule-grip"
                draggable
                role="img"
                aria-label="Glisser pour réordonner"
                title="Glisser-déposer pour changer la priorité"
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", rule.id);
                  const row = e.currentTarget.parentElement;
                  if (row) e.dataTransfer.setDragImage(row, 12, 12);
                  setDragId(rule.id);
                }}
                onDragEnd={endDrag}
              >
                ⠿
              </span>
              <input
                type="checkbox"
                checked={rule.enabled}
                onChange={(e) => patch(rule.id, { enabled: e.target.checked })}
                title="Activer / désactiver"
                aria-label="Activée"
              />
              <input
                className="rule-pattern"
                ref={(el) => {
                  if (el) patternInputs.current.set(rule.id, el);
                  else patternInputs.current.delete(rule.id);
                }}
                value={rule.pattern}
                placeholder="motif"
                onChange={(e) => patch(rule.id, { pattern: e.target.value })}
                title={errors[rule.id] ?? ""}
                aria-label="Motif"
              />
              {sample !== "" && rule.pattern !== "" && !errors[rule.id] && (
                <span className={ruleMatches(rule, sample) ? "sample-hit" : "sample-miss"} title={ruleMatches(rule, sample) ? "Cette règle correspond à la ligne d'exemple" : "Cette règle ne correspond pas à la ligne d'exemple"}>
                  {ruleMatches(rule, sample) ? "✓" : "✗"}
                </span>
              )}
              <button type="button" className={helpFor === rule.id ? "help-toggle on" : "help-toggle"} onClick={() => setHelpFor(helpFor === rule.id ? undefined : rule.id)} title="Aide à la saisie des expressions régulières" aria-label="Aide à la saisie" aria-expanded={helpFor === rule.id}>
                ?
              </button>
              <label title="Expression régulière">
                <input type="checkbox" checked={rule.isRegex} onChange={(e) => patch(rule.id, { isRegex: e.target.checked })} /> regex
              </label>
              <label title="Mot entier : ERROR ne trouve pas ERRORS ni MYERROR">
                <input type="checkbox" checked={rule.wholeWord} onChange={(ev) => patch(rule.id, { wholeWord: ev.target.checked })} /> Mot
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
              <button type="button" onClick={() => onChange(removeRule(rules, rule.id))} aria-label="Supprimer">
                🗑
              </button>
              {errors[rule.id] && <span className="rule-error">{errors[rule.id]}</span>}
              {helpFor === rule.id && (
                <div className="rule-help">
                  <RegexHelp
                    pattern={rule.pattern}
                    isRegex={rule.isRegex}
                    onInsert={(text) => insertInto(rule, text)}
                    onPreset={(pattern) => {
                      pendingCursor.current = { id: rule.id, cursor: pattern.length };
                      patch(rule.id, { pattern, isRegex: true });
                    }}
                    onEnableRegex={() => patch(rule.id, { isRegex: true })}
                  />
                </div>
              )}
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
