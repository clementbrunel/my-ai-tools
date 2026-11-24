// Confirmation of the "close several tabs" actions of the tab menu (settings.confirmCloseTabs).
import "./ConfirmClosePanel.css";
import { useState } from "react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

interface Props {
  names: string[];
  onConfirm(dontAskAgain: boolean): void;
  onCancel(): void;
}

const SHOWN = 8;

export function ConfirmClosePanel({ names, onConfirm, onCancel }: Props) {
  const [dontAsk, setDontAsk] = useState(false);
  return (
    <Modal title={`Fermer ${names.length} onglets ?`} onClose={onCancel} className="confirm-close">
      <ul className="confirm-close-list">
        {names.slice(0, SHOWN).map((name, i) => (
          <li key={i}>{name}</li>
        ))}
        {names.length > SHOWN && <li>… et {names.length - SHOWN} autre(s)</li>}
      </ul>
      <label className="toggle confirm-close-again">
        <input type="checkbox" checked={dontAsk} onChange={(e) => setDontAsk(e.target.checked)} />
        <span>Ne plus demander (réactivable dans Fichier › Configuration)</span>
      </label>
      <footer>
        <Button onClick={onCancel}>Annuler</Button>
        <Button variant="primary" autoFocus onClick={() => onConfirm(dontAsk)}>
          Fermer
        </Button>
      </footer>
    </Modal>
  );
}
