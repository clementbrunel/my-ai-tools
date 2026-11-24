import { useState } from "react";
import changelog from "../../../../CHANGELOG.md?raw";
import { parseChangelog } from "../../main/release-notes";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { Notes } from "./Notes";
import { locale, t } from "@cbl-log/shared";

/** "2026-11-03" -> "3 novembre 2026" / "November 3, 2026". */
function longDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString(locale(), { day: "numeric", month: "long", year: "numeric" });
}

const entries = parseChangelog(changelog);

/** "Notes de version": the CHANGELOG bundled in the app, one version at a time, starting on the installed one. */
export function ReleaseNotesPanel({ current, onClose }: { current: string; onClose(): void }) {
  const [index, setIndex] = useState(Math.max(0, entries.findIndex((e) => e.version === current)));
  const entry = entries[index];
  return (
    <Modal title={t("Notes de version")} className="update-panel" onClose={onClose}>
      <div className="update-body">
        {entry ? (
          <>
            <p className="update-versions">
              <strong>{entry.version}</strong> {entry.version === current && <span className="badge">{t("installée")}</span>}
              <span className="update-date">{longDate(entry.date)}</span>
            </p>
            <Notes body={entry.lines.join("\n")} />
          </>
        ) : (
          <p className="hint">{t("Aucune note disponible.")}</p>
        )}
      </div>
      <footer>
        <Button disabled={index >= entries.length - 1} onClick={() => setIndex(index + 1)}>
          {t("‹ Plus ancienne")}
        </Button>
        <span className="hint">{entries.length > 0 ? `${index + 1} / ${entries.length}` : ""}</span>
        <Button disabled={index === 0} onClick={() => setIndex(index - 1)}>
          {t("Plus récente ›")}
        </Button>
        <Button onClick={onClose}>
          {t("Fermer")}
        </Button>
      </footer>
    </Modal>
  );
}
