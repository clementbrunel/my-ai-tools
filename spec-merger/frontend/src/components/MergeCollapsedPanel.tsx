interface MergeCollapsedPanelProps {
  /** Both source docs are generated — collapsing still lets the user reopen and merge in one click. */
  ready: boolean
  onExpand: () => void
}

function MergeCollapsedPanel({ ready, onExpand }: MergeCollapsedPanelProps) {
  const label = ready ? 'Fusion prête' : 'Fusion'
  return (
    <button
      type="button"
      onClick={onExpand}
      title={`Afficher ${label}`}
      aria-label={`Afficher ${label}`}
      className={`rounded border flex flex-col items-center justify-center gap-3 py-4 transition-colors ${
        ready
          ? 'bg-[#fff8f4] border-gl-orange text-gl-orange-dark hover:bg-[#ffeee2]'
          : 'bg-white border-[#dcdcde] text-gray-400 hover:text-gl-blue hover:border-gl-blue'
      }`}
    >
      {ready && <span aria-hidden="true" className="w-2 h-2 rounded-full bg-gl-success shrink-0" />}
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0"
      >
        <circle cx="6" cy="6" r="2.5" />
        <circle cx="6" cy="18" r="2.5" />
        <circle cx="18" cy="18" r="2.5" />
        <path d="M6 8.5V13a4 4 0 0 0 4 4h3.5" />
      </svg>
      <span className="[writing-mode:vertical-rl] rotate-180 text-[11px] font-semibold uppercase tracking-wide">
        {label}
      </span>
    </button>
  )
}

export default MergeCollapsedPanel
