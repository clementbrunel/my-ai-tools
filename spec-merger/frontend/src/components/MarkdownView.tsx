import { useMemo, useState } from 'react'
import { normalizeMarkdown, renderMarkdown } from '../markdown'
import RichMarkdownEditor from './RichMarkdownEditor'

interface MarkdownViewProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
}

const TABS = [
  { key: 'preview', label: 'Aperçu' },
  { key: 'richEdit', label: 'Édition Markdown' },
  { key: 'edit', label: 'Édition Libre' },
] as const

type ViewMode = (typeof TABS)[number]['key']

/** An Aperçu/Édition Markdown/Édition Libre toggle over a markdown value — Aperçu renders it
 * (sanitized) read-only, Édition Markdown edits it through a rich-text (WYSIWYG) editor, and
 * Édition Libre exposes the raw markdown textarea for cases the rich editor can't express.
 * Defaults to Aperçu so generated docs are read before being edited. */
function MarkdownView({ value, onChange, placeholder }: MarkdownViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('preview')

  const previewHtml = useMemo(() => {
    if (viewMode !== 'preview') return ''
    return renderMarkdown(value)
  }, [viewMode, value])

  // MDXEditor parses `value` itself (it doesn't go through renderMarkdown), so it needs the
  // same defencing the Aperçu tab gets — otherwise a whole-document ```markdown fence renders
  // as one uneditable code block there too.
  const richEditValue = useMemo(() => normalizeMarkdown(value), [value])

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex gap-3 text-sm border-b border-[#dcdcde] mb-2 shrink-0">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={`pb-2 -mb-px border-b-2 ${
              viewMode === key
                ? 'border-gl-orange text-[#303030] font-medium'
                : 'border-transparent text-gray-500 hover:text-[#303030]'
            }`}
            onClick={() => setViewMode(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {viewMode === 'richEdit' ? (
        <RichMarkdownEditor value={richEditValue} onChange={onChange} placeholder={placeholder} />
      ) : viewMode === 'edit' ? (
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
