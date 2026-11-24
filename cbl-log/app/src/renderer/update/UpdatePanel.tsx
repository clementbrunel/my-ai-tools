import "./UpdatePanel.css";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import type { UpdatePanelState } from "../../main/update-check";
import { Notes } from "./Notes";
import { locale, t } from "@cbl-log/shared";

interface Props {
  state: UpdatePanelState;
  /** Closes the panel locally (info / error states; "available" is answered through the main process). */
  onClose(): void;
}

const mb = (bytes: number): string => t("{n} Mo", { n: (bytes / 1024 / 1024).toLocaleString(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }) });

/** In-app modal for the update flow (replaces the native message boxes): offer, download progress, "up to date", errors. */
export function UpdatePanel({ state, onClose }: Props) {
  const dismiss = (): void => {
    if (state.kind === "available") window.cblLog.updateAction("dismiss");
    onClose();
  };
  const locked = state.kind === "downloading";

  let title = t("Mise à jour");
  let body: JSX.Element;
  let footer: JSX.Element;
  switch (state.kind) {
    case "available":
      title = t("Mise à jour disponible");
      body = (
        <>
          <p className="update-versions">
            <span>{state.current}</span> <span aria-hidden="true">→</span> <strong>{state.version}</strong>
          </p>
          {state.notes && (
            <>
              <h3>{t("Nouveautés de la {version}", { version: state.version })}</h3>
              <Notes body={state.notes} />
            </>
          )}
          <p className="hint">
            {!state.canInstall
              ? t("Installation automatique indisponible en mode développement.")
              : state.portable
                ? t("La nouvelle version portable sera téléchargée à côté de l'actuelle puis lancée.")
                : t("La mise à jour est téléchargée puis installée ; cbl-log redémarre et rouvre vos onglets.")}
          </p>
        </>
      );
      footer = (
        <>
          {state.canInstall && (
            <Button variant="primary" autoFocus onClick={() => window.cblLog.updateAction("install")}>
              {t("Mettre à jour")}
            </Button>
          )}
          <Button onClick={() => window.cblLog.updateAction("notes")}>
            {t("Page de la release")}
          </Button>
          <Button onClick={dismiss}>
            {t("Plus tard")}
          </Button>
        </>
      );
      break;
    case "downloading": {
      title = t("Téléchargement de cbl-log {version}", { version: state.version });
      const ratio = state.total > 0 ? Math.min(1, state.received / state.total) : undefined;
      body = (
        <>
          <progress className="update-progress" max={1} value={ratio} />
          <p className="hint">
            {ratio === undefined ? mb(state.received) : `${mb(state.received)} / ${mb(state.total)} (${Math.round(ratio * 100)} %)`}
            {t(" — cbl-log va redémarrer et rouvrir vos onglets.")}
          </p>
        </>
      );
      footer = <></>;
      break;
    }
    case "uptodate":
      body = <p className="update-message">{t("cbl-log {version} est à jour.", { version: state.current })}</p>;
      footer = (
        <Button variant="primary" autoFocus onClick={dismiss}>
          OK
        </Button>
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
        <Button autoFocus onClick={dismiss}>
          {t("Fermer")}
        </Button>
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
