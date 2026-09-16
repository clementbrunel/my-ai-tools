import { useMemo, useState } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import type { DocumentVersion } from '../types'

interface MergePanelProps {
  markdown: string
  onMarkdownChange: (value: string) => void
  versions: DocumentVersion[]
  onRestore: (versionId: string) => void
}

marked.setOptions({ gfm: true, breaks: false })

function MergePanel({ markdown, onMarkdownChange, versions, onRestore }: MergePanelProps) {
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit')

  const previewHtml = useMemo(() => {
    if (viewMode !== 'preview') return ''
    return DOMPurify.sanitize(marked.parse(markdown, { async: false }) as string)
  }, [viewMode, markdown])

  return (
    <section className="card p-4 overflow-auto flex flex-col">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="field-label">Markdown de fusion</h2>
        <div className="flex gap-3 text-sm border-b border-[#dcdcde]">
          {(['edit', 'preview'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`pb-2 -mb-px border-b-2 ${
                viewMode === mode
                  ? 'border-gl-orange text-[#303030] font-medium'
                  : 'border-transparent text-gray-500 hover:text-[#303030]'
              }`}
              onClick={() => setViewMode(mode)}
            >
              {mode === 'edit' ? 'Édition' : 'Aperçu'}
            </button>
          ))}
        </div>
      </div>
      {viewMode === 'edit' ? (
        <textarea
          value={markdown}
          onChange={(e) => onMarkdownChange(e.target.value)}
          placeholder="Le markdown de fusion apparaîtra ici après analyse."
          className="w-full min-h-[50vh] flex-1 rounded border border-[#dcdcde] p-2 font-mono text-[13px] focus:outline-none focus:ring-2 focus:ring-gl-orange"
        />
      ) : markdown.trim() ? (
        <div
          className="markdown-preview w-full min-h-[50vh] flex-1 rounded border border-[#dcdcde] p-3 overflow-auto text-sm"
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      ) : (
        <p className="w-full min-h-[50vh] flex-1 rounded border border-[#dcdcde] p-2 text-sm text-gray-400">
          Le markdown de fusion apparaîtra ici après analyse.
        </p>
      )}
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
