interface CollapsedPanelProps {
  label: string
  icon: string
  onExpand: () => void
}

function CollapsedPanel({ label, icon, onExpand }: CollapsedPanelProps) {
  return (
    <button
      type="button"
      onClick={onExpand}
      title={`Afficher ${label}`}
      aria-label={`Afficher ${label}`}
      className="card flex flex-col items-center justify-center gap-3 py-4 text-gray-400 hover:text-gl-blue hover:border-gl-blue transition-colors"
    >
      <span aria-hidden="true">{icon}</span>
      <span className="[writing-mode:vertical-rl] rotate-180 text-[11px] font-semibold uppercase tracking-wide">
        {label}
      </span>
    </button>
  )
}

export default CollapsedPanel
