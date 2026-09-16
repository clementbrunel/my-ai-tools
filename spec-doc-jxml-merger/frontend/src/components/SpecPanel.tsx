interface SpecPanelProps {
  wordFile: File | null
  onWordFileChange: (file: File | null) => void
}

function SpecPanel({ wordFile, onWordFileChange }: SpecPanelProps) {
  return (
    <section className="card p-4 overflow-auto">
      <h2 className="field-label mb-3">Spec Word (optionnel)</h2>
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
