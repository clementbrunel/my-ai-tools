import { Modal } from "../ui/Modal";
import type { UpdatePanelState } from "../../main/update-check";
import { Notes } from "./Notes";

interface Props {
  state: UpdatePanelState;
  /** Closes the panel locally (info / error states; "available" is answered through the main process). */
  onClose(): void;
}

const mb = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(1)} Mo`;

/** In-app modal for the update flow (replaces the native message boxes): offer, download progress, "up to date", errors. */
export function UpdatePanel({ state, onClose }: Props) {
  const dismiss = (): void => {
    if (state.kind === "available") window.cblLog.updateAction("dismiss");
    onClose();
  };
  const locked = state.kind === "downloading";

  let title = "Mise à jour";
  let body: JSX.Element;
  let footer: JSX.Element;
  switch (state.kind) {
    case "available":
      title = "Mise à jour disponible";
      body = (
        <>
          <p className="update-versions">
            <span>{state.current}</span> <span aria-hidden="true">→</span> <strong>{state.version}</strong>
          </p>
          {state.notes && (
            <>
              <h3>Nouveautés de la {state.version}</h3>
              <Notes body={state.notes} />
            </>
          )}
          <p className="hint">
            {!state.canInstall
              ? "Installation automatique indisponible en mode développement."
              : state.portable
                ? "La nouvelle version portable sera téléchargée à côté de l'actuelle puis lancée."
                : "La mise à jour est téléchargée puis installée ; cbl-log redémarre et rouvre vos onglets."}
          </p>
        </>
      );
      footer = (
        <>
          {state.canInstall && (
            <button type="button" className="primary" autoFocus onClick={() => window.cblLog.updateAction("install")}>
              Mettre à jour
            </button>
          )}
          <button type="button" onClick={() => window.cblLog.updateAction("notes")}>
            Page de la release
          </button>
          <button type="button" onClick={dismiss}>
            Plus tard
          </button>
        </>
      );
      break;
    case "downloading": {
      title = `Téléchargement de cbl-log ${state.version}`;
      const ratio = state.total > 0 ? Math.min(1, state.received / state.total) : undefined;
      body = (
        <>
          <progress className="update-progress" max={1} value={ratio} />
          <p className="hint">
            {ratio === undefined ? mb(state.received) : `${mb(state.received)} / ${mb(state.total)} (${Math.round(ratio * 100)} %)`} — cbl-log va
            redémarrer et rouvrir vos onglets.
          </p>
        </>
      );
      footer = <></>;
      break;
    }
    case "uptodate":
      body = <p className="update-message">cbl-log {state.current} est à jour.</p>;
      footer = (
        <button type="button" className="primary" autoFocus onClick={dismiss}>
          OK
        </button>
      );
      break;
    case "error":
      title = state.title;
      body = (
        <p className="feedback-error" role="alert">
          {state.message}
        </p>
      );
      footer = (
        <button type="button" autoFocus onClick={dismiss}>
          Fermer
        </button>
      );
      break;
  }

  return (
    <Modal title={title} className="update-panel" onClose={dismiss} locked={locked}>
      <div className="update-body">{body}</div>
      {!locked && <footer>{footer}</footer>}
    </Modal>
  );
}
