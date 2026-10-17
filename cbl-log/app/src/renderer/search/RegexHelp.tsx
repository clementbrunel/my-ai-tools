import { PRESETS, SNIPPETS, explain } from "./regex-help";

interface Props {
  pattern: string;
  /** Regex mode on: when off, the panel explains how to turn it on. */
  isRegex: boolean;
  onInsert(text: string): void;
  onPreset(pattern: string): void;
  onEnableRegex(): void;
}

/** Help panel for typing regular expressions: reading of the current pattern, blocks, ready-made patterns. */
export function RegexHelp({ pattern, isRegex, onInsert, onPreset, onEnableRegex }: Props) {
  // keep the focus (and the cursor) in the field being edited
  const keepFocus = (e: { preventDefault(): void }): void => e.preventDefault();
  const reading = isRegex && pattern !== "" ? explain(pattern) : [];

  return (
    <div className="regex-help" onMouseDown={keepFocus}>
      {!isRegex && (
        <p className="regex-help-note">
          Le texte saisi est cherché <strong>tel quel</strong>. Pour des motifs plus souples (chiffres, alternatives, début de ligne…),{" "}
          <button type="button" className="link" onClick={onEnableRegex}>
            activer les expressions régulières
          </button>
          .
        </p>
      )}

      {reading.length > 0 && (
        <section>
          <h3>Votre motif, en clair</h3>
          <ul className="regex-reading">
            {reading.map((item, i) => (
              <li key={i}>
                <code>{item.token}</code> {item.meaning}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3>Insérer</h3>
        <div className="regex-chips">
          {SNIPPETS.map((s) => (
            <button key={s.label} type="button" title={s.description} onClick={() => onInsert(s.insert)}>
              {s.label} <code>{s.insert}</code>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3>Modèles courants</h3>
        <div className="regex-chips">
          {PRESETS.map((p) => (
            <button key={p.label} type="button" title={`${p.pattern}\nex. : ${p.example}`} onClick={() => onPreset(p.pattern)}>
              {p.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
