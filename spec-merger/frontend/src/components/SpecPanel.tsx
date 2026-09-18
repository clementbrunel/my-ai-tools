import { useEffect, useMemo, useState } from 'react'
import { generateSpecFromWord, previewWord } from '../api/analysis'
import { renderMarkdown } from '../markdown'
import FullPageLoader from './FullPageLoader'
import MarkdownView from './MarkdownView'

interface SpecPanelProps {
  onCollapse?: () => void
}

type Tab = 'input' | 'output'

const ACCEPTED_EXTENSIONS = ['.doc', '.docx', '.xlsx']

function hasAcceptedExtension(filename: string): boolean {
  const lower = filename.toLowerCase()
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

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
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewContent, setPreviewContent] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewViewMode, setPreviewViewMode] = useState<'rendered' | 'raw'>('rendered')

  const previewHtml = useMemo(() => renderMarkdown(previewContent), [previewContent])

  useEffect(() => {
    if (!previewOpen) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setPreviewOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [previewOpen])

  function handleFileChange(file: File | null) {
    if (file && !hasAcceptedExtension(file.name)) {
      setError('Format non supporté — seuls les fichiers .doc, .docx et .xlsx sont acceptés.')
      setWordFile(null)
      return
    }
    setError(null)
    setWordFile(file)
  }

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

  /** Opens the read-only modal showing the text extracted from the Word file, before it's sent to the model. */
  async function handlePreviewWord() {
    if (!wordFile) return
    setError(null)
    setPreviewOpen(true)
    setPreviewLoading(true)
    try {
      setPreviewContent(await previewWord(wordFile))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec de la prévisualisation — voir la console.')
      console.error(e)
      setPreviewOpen(false)
    } finally {
      setPreviewLoading(false)
    }
  }

  return (
    <>
      {loading && <FullPageLoader message="Génération de la doc depuis le Word en cours…" />}
      <section className="card p-4 overflow-auto min-h-0 flex flex-col">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="field-label">Spec Word / Excel</h2>
          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              title="Réduire le panneau"
              aria-label="Réduire le panneau Spec Word / Excel"
              className="text-gray-400 hover:text-gl-blue leading-none px-1 shrink-0"
            >
              ◀
            </button>
          )}
        </div>
        <div className="flex mb-3 border-b border-[#dcdcde] text-sm shrink-0">
          {(['input', 'output'] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={`flex-1 basis-1/2 text-center pb-2 -mb-px border-b-2 ${
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
            <div className="flex items-center gap-3 justify-end">
              <span className="text-sm text-gray-500">{wordFile ? wordFile.name : 'Aucun fichier choisi'}</span>
              <label
                htmlFor="spec-word-file"
                className="btn-primary cursor-pointer text-sm py-1.5 px-3"
              >
                Choisir un fichier
              </label>
              <input
                id="spec-word-file"
                type="file"
                accept=".doc,.docx,.xlsx"
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                className="sr-only"
              />
            </div>
            {wordFile && (
              <button
                type="button"
                className="btn-secondary self-end"
                onClick={handlePreviewWord}
                disabled={previewLoading}
              >
                {previewLoading ? 'Extraction…' : 'Prévisualiser le texte extrait'}
              </button>
            )}
            {previewOpen && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                onClick={() => setPreviewOpen(false)}
              >
                <div
                  className="bg-white rounded shadow-xl w-full max-w-5xl max-h-[85vh] flex flex-col"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[#dcdcde] bg-[#fafafa] text-sm shrink-0">
                    <span className="text-gray-600">Markdown extrait du Word/Excel, envoyé tel quel au modèle</span>
                    <button
                      type="button"
                      className="text-gl-blue hover:text-gl-blue-dark hover:underline"
                      onClick={() => setPreviewOpen(false)}
                    >
                      Fermer
                    </button>
                  </div>
                  {previewLoading ? (
                    <p className="text-sm text-gray-500 p-3">Chargement…</p>
                  ) : (
                    <>
                      <div className="flex gap-4 px-3 pt-2 text-sm border-b border-[#dcdcde] shrink-0">
                        {(['rendered', 'raw'] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            className={`pb-2 -mb-px border-b-2 ${
                              previewViewMode === mode
                                ? 'border-gl-orange text-[#303030] font-medium'
                                : 'border-transparent text-gray-500 hover:text-[#303030]'
                            }`}
                            onClick={() => setPreviewViewMode(mode)}
                          >
                            {mode === 'rendered' ? 'Aperçu' : 'Markdown brut'}
                          </button>
                        ))}
                      </div>
                      <div className="overflow-auto p-3 flex-1">
                        {previewViewMode === 'rendered' ? (
                          <div className="markdown-preview text-sm" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                        ) : (
                          <pre className="text-[12px] whitespace-pre-wrap break-all">{previewContent}</pre>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
            <div className="mt-auto pt-3 border-t border-[#eee] flex items-center gap-3 justify-end">
              {error && <span className="text-sm text-gl-danger">{error}</span>}
              <button type="button" className="btn-primary" onClick={handleGenerate} disabled={!wordFile || loading}>
                {loading ? 'Génération…' : 'Générer la doc'}
              </button>
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
    </>
  )
}

export default SpecPanel
