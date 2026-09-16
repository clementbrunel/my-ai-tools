interface SpecPanelProps {
  wordFile: File | null
  onWordFileChange: (file: File | null) => void
  onCollapse?: () => void
}

function SpecPanel({ wordFile, onWordFileChange, onCollapse }: SpecPanelProps) {
  return (
    <section className="card p-4 overflow-auto">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="field-label">Spec Word (optionnel)</h2>
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            title="Réduire le panneau"
            aria-label="Réduire le panneau Spec Word"
            className="text-gray-400 hover:text-gl-blue leading-none px-1 shrink-0"
          >
            ◀
          </button>
        )}
      </div>
      <input
        type="file"
        accept=".docx"
        onChange={(e) => onWordFileChange(e.target.files?.[0] ?? null)}
        className="text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-gl-blue file:text-white file:text-sm hover:file:bg-gl-blue-dark file:cursor-pointer"
      />
      {wordFile && <p className="text-sm text-gray-500 mt-2">{wordFile.name}</p>}
    </section>
  )
}

export default SpecPanel
