import "./Modal.css";
import { useEffect, type ReactNode } from "react";
import { Button } from "./Button";

interface Props {
  title: string;
  onClose(): void;
  /** Extra class on the dialog (sets its width / inner layout). */
  className?: string;
  /** Not dismissable (Escape, backdrop and × disabled), e.g. during a download. */
  locked?: boolean;
  /** Body, then optionally a `<footer>` (styled by `.modal footer`). */
  children: ReactNode;
}

/** The one modal of the app: backdrop, dialog frame, title bar with ×, Escape / outside click to close. */
export function Modal({ title, onClose, className, locked, children }: Props) {
  useEffect(() => {
    if (locked) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, locked]);

  return (
    <div className="modal-backdrop" onMouseDown={locked ? undefined : onClose}>
      <div className={className ? `modal ${className}` : "modal"} role="dialog" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <header>
          <h2>{title}</h2>
          {!locked && (
            <Button variant="ghost" onClick={onClose} aria-label="Fermer">
              ×
            </Button>
          )}
        </header>
        {children}
      </div>
    </div>
  );
}
