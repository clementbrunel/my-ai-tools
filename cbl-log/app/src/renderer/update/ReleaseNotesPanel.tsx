import { useState } from "react";
import changelog from "../../../../CHANGELOG.md?raw";
import { parseChangelog } from "../../main/release-notes";
import { Modal } from "../ui/Modal";
import { Notes } from "./Notes";

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
function frenchDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] ?? ""} ${m[1]}` : iso;
}

const entries = parseChangelog(changelog);

/** "Notes de version": the CHANGELOG bundled in the app, one version at a time, starting on the installed one. */
export function ReleaseNotesPanel({ current, onClose }: { current: string; onClose(): void }) {
  const [index, setIndex] = useState(Math.max(0, entries.findIndex((e) => e.version === current)));
  const entry = entries[index];
  return (
    <Modal title="Notes de version" className="update-panel" onClose={onClose}>
      <div className="update-body">
        {entry ? (
          <>
            <p className="update-versions">
              <strong>{entry.version}</strong> {entry.version === current && <span className="badge">installée</span>}
              <span className="update-date">{frenchDate(entry.date)}</span>
            </p>
            <Notes body={entry.lines.join("\n")} />
          </>
        ) : (
          <p className="hint">Aucune note disponible.</p>
        )}
      </div>
      <footer>
        <button type="button" disabled={index >= entries.length - 1} onClick={() => setIndex(index + 1)}>
          ‹ Plus ancienne
        </button>
        <span className="hint">{entries.length > 0 ? `${index + 1} / ${entries.length}` : ""}</span>
        <button type="button" disabled={index === 0} onClick={() => setIndex(index - 1)}>
          Plus récente ›
        </button>
        <button type="button" onClick={onClose}>
          Fermer
        </button>
      </footer>
    </Modal>
  );
}
