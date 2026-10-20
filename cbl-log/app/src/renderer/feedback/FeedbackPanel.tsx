import { useEffect, useState } from "react";
import type { FeedbackDraft } from "../../preload/api";
import { DESCRIPTION_MAX, TITLE_MAX, validateDraft } from "../../main/feedback";

interface Props {
  onClose(): void;
  /** Result shown by the parent once the panel is closed. */
  onNotice(text: string, isError: boolean): void;
}

const PLACEHOLDER: Record<FeedbackDraft["kind"], string> = {
  bug: "Ce que vous faisiez, ce qui s'est passé, ce que vous attendiez (fichier, format de log, étapes pour reproduire…)",
  request: "Ce que vous aimeriez pouvoir faire, et dans quel cas cela vous servirait",
};

/** Modal report form: the main process opens it as a pre-filled GitHub issue, after its anti-flood check. */
export function FeedbackPanel({ onClose, onNotice }: Props) {
  const [draft, setDraft] = useState<FeedbackDraft>({ kind: "bug", title: "", description: "", includeEnv: true });
  const [env, setEnv] = useState<string[]>([]);
  const [blocked, setBlocked] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    void window.cblLog.feedbackStatus().then((status) => {
      setEnv(status.env);
      setBlocked(status.blocked);
    });
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const invalid = validateDraft(draft);
  const patch = (change: Partial<FeedbackDraft>): void => {
    setDraft((d) => ({ ...d, ...change }));
    setError(undefined);
  };
  const submit = async (): Promise<void> => {
    setTried(true);
    if (invalid || busy) return;
    setBusy(true);
    try {
      const result = await window.cblLog.submitFeedback(draft);
      if (result.ok) {
        onNotice("Le signalement s'est ouvert dans votre navigateur : vérifiez-le puis cliquez sur « Create » sur GitHub.", false);
        onClose();
      } else {
        setError(result.reason);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal feedback-panel" role="dialog" aria-label="Signaler un bug ou proposer une idée" onMouseDown={(e) => e.stopPropagation()}>
        <header>
          <h2>Signaler un bug / proposer une idée</h2>
          <button type="button" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </header>
        <p className="hint">
          Le signalement s'ouvre dans votre navigateur, pré-rempli sur la page « New issue » du dépôt GitHub : vous le relisez et
          l'envoyez avec votre compte GitHub. cbl-log n'envoie rien lui-même. Aucun chemin de fichier ni contenu de log n'est ajouté :
          collez vous-même les lignes utiles si besoin (en retirant les données sensibles).
        </p>
        <form
          className="feedback-form"
          onSubmit={(ev) => {
            ev.preventDefault();
            void submit();
          }}
        >
          <div className="view-switch" role="radiogroup" aria-label="Type">
            {(["bug", "request"] as const).map((kind) => (
              <button key={kind} type="button" role="radio" aria-checked={draft.kind === kind} className={draft.kind === kind ? "on" : ""} onClick={() => patch({ kind })}>
                {kind === "bug" ? "Bug" : "Idée / demande"}
              </button>
            ))}
          </div>
          <label>
            Titre
            <input
              autoFocus
              value={draft.title}
              maxLength={TITLE_MAX}
              onChange={(ev) => patch({ title: ev.target.value })}
              placeholder={draft.kind === "bug" ? "Ex. : le suivi s'arrête après la rotation du fichier" : "Ex. : exporter la vue filtrée"}
            />
          </label>
          <label>
            Description
            <textarea
              rows={8}
              value={draft.description}
              maxLength={DESCRIPTION_MAX}
              onChange={(ev) => patch({ description: ev.target.value })}
              placeholder={PLACEHOLDER[draft.kind]}
            />
          </label>
          <label className="feedback-env" title={env.join("\n")}>
            <input type="checkbox" checked={draft.includeEnv} onChange={(ev) => patch({ includeEnv: ev.target.checked })} /> Joindre la version et le
            système ({env.length ? env.join(" · ") : "…"})
          </label>
          {(error ?? blocked ?? (tried ? invalid : undefined)) && (
            <p className="feedback-error" role="alert">
              {error ?? blocked ?? invalid}
            </p>
          )}
          <footer>
            <button type="submit" disabled={busy || !!blocked || (tried && !!invalid)}>
              Ouvrir sur GitHub…
            </button>
            <button type="button" onClick={onClose}>
              Annuler
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
