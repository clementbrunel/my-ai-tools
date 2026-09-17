import { useMemo, useState } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

interface MarkdownViewProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
}

marked.setOptions({ gfm: true, breaks: false })

/** An Édition/Aperçu toggle over a markdown value — the textarea edits it, the Aperçu tab renders it (sanitized). */
function MarkdownView({ value, onChange, placeholder }: MarkdownViewProps) {
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit')

  const previewHtml = useMemo(() => {
    if (viewMode !== 'preview') return ''
    return DOMPurify.sanitize(marked.parse(value, { async: false }) as string)
  }, [viewMode, value])

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex gap-3 text-sm border-b border-[#dcdcde] mb-2 shrink-0">
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
      {viewMode === 'edit' ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full flex-1 min-h-0 rounded border border-[#dcdcde] p-2 font-mono text-[13px] focus:outline-none focus:ring-2 focus:ring-gl-orange"
        />
      ) : value.trim() ? (
        <div
          className="markdown-preview w-full flex-1 min-h-0 rounded border border-[#dcdcde] p-3 overflow-auto text-sm"
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      ) : (
        <p className="w-full flex-1 min-h-0 rounded border border-[#dcdcde] p-2 text-sm text-gray-400">
          {placeholder}
        </p>
      )}
    </div>
  )
}

export default MarkdownView
