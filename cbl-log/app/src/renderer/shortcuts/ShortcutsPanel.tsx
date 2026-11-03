import "./ShortcutsPanel.css";
import { useState } from "react";
import { Modal } from "../ui/Modal";
import { SHORTCUT_GROUPS, filterGroups, type Shortcut } from "./shortcuts";

function Combo({ keys }: { keys: readonly string[] }) {
  return (
    <span className="kbd-combo">
      {keys.map((k, i) => (
        <span key={i}>
          {i > 0 && <span className="kbd-plus">+</span>}
          <kbd>{k}</kbd>
        </span>
      ))}
    </span>
  );
}

function Row({ shortcut }: { shortcut: Shortcut }) {
  return (
    <li>
      <span className="kbd-keys">
        <Combo keys={shortcut.keys} />
        {shortcut.alt && (
          <>
            <span className="kbd-or">ou</span>
            <Combo keys={shortcut.alt} />
          </>
        )}
      </span>
      <span className="kbd-label">{shortcut.label}</span>
    </li>
  );
}

/** "Raccourcis clavier": a filterable cheat-sheet, one card per theme, fed by `SHORTCUT_GROUPS`. */
export function ShortcutsPanel({ onClose }: { onClose(): void }) {
  const [query, setQuery] = useState("");
  const groups = filterGroups(SHORTCUT_GROUPS, query);
  return (
    <Modal title="Raccourcis clavier" className="shortcuts-panel" onClose={onClose}>
      <div className="shortcuts-search">
        <input autoFocus type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filtrer : « recherche », « Ctrl », « copier »…" aria-label="Filtrer les raccourcis" />
      </div>
      <div className="shortcuts-grid">
        {groups.map((g) => (
          <section key={g.id} className="shortcut-card">
            <h3>
              <span className="shortcut-icon" aria-hidden="true">
                {g.icon}
              </span>
              {g.title}
            </h3>
            <ul>
              {g.shortcuts.map((s) => (
                <Row key={s.keys.join("+")} shortcut={s} />
              ))}
            </ul>
          </section>
        ))}
        {groups.length === 0 && <p className="hint">Aucun raccourci ne correspond à « {query} ».</p>}
      </div>
    </Modal>
  );
}
