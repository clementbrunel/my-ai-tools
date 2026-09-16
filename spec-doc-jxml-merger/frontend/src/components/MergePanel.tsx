import type { DocumentVersion } from '../types'

interface MergePanelProps {
  markdown: string
  onMarkdownChange: (value: string) => void
  versions: DocumentVersion[]
  onRestore: (versionId: string) => void
}

function MergePanel({ markdown, onMarkdownChange, versions, onRestore }: MergePanelProps) {
  return (
    <section className="card p-4 overflow-auto flex flex-col">
      <h2 className="field-label mb-3">Markdown de fusion</h2>
      <textarea
        value={markdown}
        onChange={(e) => onMarkdownChange(e.target.value)}
        placeholder="Le markdown de fusion apparaîtra ici après analyse."
        className="w-full min-h-[50vh] flex-1 rounded border border-[#dcdcde] p-2 font-mono text-[13px] focus:outline-none focus:ring-2 focus:ring-gl-orange"
      />
      {versions.length > 0 && (
        <div className="mt-4">
          <h3 className="field-label mb-2">Historique</h3>
          <ul className="text-sm divide-y divide-[#eee]">
            {versions.map((v) => (
              <li key={v.id} className="py-1.5 flex items-center justify-between gap-2">
                <span className="text-gray-600">
                  v{v.versionNumber} — {v.source} — {new Date(v.createdAt).toLocaleString('fr-FR')}
                </span>
                <button
                  onClick={() => onRestore(v.id)}
                  className="text-gl-blue hover:text-gl-blue-dark hover:underline shrink-0"
                >
                  Restaurer
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

export default MergePanel
