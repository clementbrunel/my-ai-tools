interface ConfirmDialogProps {
  open: boolean
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  /** Styles the confirm button red — for actions that discard or destroy something. */
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Stand-in for `window.confirm`, styled to match the app rather than the browser chrome. */
function ConfirmDialog({
  open,
  title = 'Confirmation',
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className="card w-full max-w-sm shadow-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className="text-base font-semibold text-[#303030] mb-2">
          {title}
        </h2>
        <p id="confirm-dialog-message" className="text-sm text-gray-600 mb-5">
          {message}
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={
              danger
                ? 'btn-primary !bg-gl-danger hover:!bg-gl-danger/90'
                : 'btn-primary'
            }
            onClick={onConfirm}
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialog
