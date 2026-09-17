import { useState } from 'react'
import { generateSpecFromWord } from '../api/analysis'
import MarkdownView from './MarkdownView'

interface SpecPanelProps {
  onCollapse?: () => void
}

type Tab = 'input' | 'output'

function downloadMarkdown(markdown: string, filename: string) {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function SpecPanel({ onCollapse }: SpecPanelProps) {
  const [wordFile, setWordFile] = useState<File | null>(null)
  const [markdown, setMarkdown] = useState('')
  const [tab, setTab] = useState<Tab>('input')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    if (!wordFile) return
    setError(null)
    setLoading(true)
    try {
      setMarkdown(await generateSpecFromWord(wordFile))
      setTab('output')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec de la génération — voir la console.')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="card p-4 overflow-auto min-h-0 flex flex-col">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="field-label">Spec Word</h2>
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
      <div className="flex gap-4 mb-3 border-b border-[#dcdcde] text-sm shrink-0">
        {(['input', 'output'] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`pb-2 -mb-px border-b-2 ${
              tab === t
                ? 'border-gl-orange text-[#303030] font-medium'
                : 'border-transparent text-gray-500 hover:text-[#303030]'
            }`}
            onClick={() => setTab(t)}
          >
            {t === 'input' ? 'Input' : 'Output'}
          </button>
        ))}
      </div>

      {tab === 'input' ? (
        <div className="flex flex-col gap-3 min-h-0 flex-1">
          <div className="flex items-center gap-3">
            <label
              htmlFor="spec-word-file"
              className="btn-primary cursor-pointer text-sm py-1.5 px-3"
            >
              Choisir un fichier
            </label>
            <input
              id="spec-word-file"
              type="file"
              accept=".docx"
              onChange={(e) => setWordFile(e.target.files?.[0] ?? null)}
              className="sr-only"
            />
            <span className="text-sm text-gray-500">{wordFile ? wordFile.name : 'Aucun fichier choisi'}</span>
          </div>
          <div className="mt-auto pt-3 border-t border-[#eee] flex items-center gap-3">
            <button type="button" className="btn-primary" onClick={handleGenerate} disabled={!wordFile || loading}>
              {loading ? 'Génération…' : 'Générer la doc'}
            </button>
            {error && <span className="text-sm text-gl-danger">{error}</span>}
          </div>
        </div>
      ) : (
        <div className="flex flex-col min-h-0 flex-1 gap-2">
          {markdown && (
            <div className="flex justify-end shrink-0">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => downloadMarkdown(markdown, 'spec-word.md')}
              >
                Télécharger
              </button>
            </div>
          )}
          <MarkdownView
            value={markdown}
            onChange={setMarkdown}
            placeholder="La doc générée depuis le Word apparaîtra ici après génération."
          />
        </div>
      )}
    </section>
  )
}

export default SpecPanel
