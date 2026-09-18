import { useState } from 'react'
import { mergeSpecs } from '../api/analysis'
import FullPageLoader from './FullPageLoader'
import MarkdownView from './MarkdownView'

interface MergePanelProps {
  wordMarkdown: string
  jxmlMarkdown: string
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

function MergePanel({ wordMarkdown, jxmlMarkdown }: MergePanelProps) {
  const [merged, setMerged] = useState('')
  // Tracks the last AI-generated result so a re-merge can tell whether the user has since
  // hand-edited it, and only then ask for confirmation before overwriting.
  const [lastGenerated, setLastGenerated] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const bothReady = wordMarkdown.trim() !== '' && jxmlMarkdown.trim() !== ''
  // Whether a merge has ever succeeded — distinct from `merged` being non-empty, since the user
  // can legitimately clear the editable result down to an empty string while editing it.
  const hasResult = lastGenerated !== null
  const hasUnsavedEdits = hasResult && merged !== lastGenerated

  async function runMerge() {
    setError(null)
    setLoading(true)
    try {
      const result = await mergeSpecs(wordMarkdown, jxmlMarkdown)
      setMerged(result)
      setLastGenerated(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec de la fusion — voir la console.')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  function handleMergeClick() {
    if (hasUnsavedEdits) {
      const confirmed = window.confirm(
        'Le document fusionné a été modifié manuellement. Relancer la fusion écrasera ces modifications. Continuer ?',
      )
      if (!confirmed) return
    }
    void runMerge()
  }

  return (
    <>
      {loading && <FullPageLoader message="Fusion des deux documentations en cours…" />}
      <section className="card p-4 overflow-auto min-h-0 flex flex-col">
        <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
          <h2 className="field-label">Fusion</h2>
          {hasResult && (
            <div className="flex items-center gap-3">
              <button type="button" className="btn-secondary" onClick={() => downloadMarkdown(merged, 'spec-fusion.md')}>
                Télécharger
              </button>
              <button type="button" className="btn-secondary" onClick={handleMergeClick} disabled={!bothReady}>
                Refusionner
              </button>
            </div>
          )}
        </div>

        {!bothReady ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-2">
            <p className="text-sm text-gray-500 max-w-sm">
              Génère la doc dans chacun des panneaux Input/Output à gauche et à droite pour activer la fusion.
            </p>
          </div>
        ) : !hasResult ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
            <p className="text-sm text-gray-500 max-w-sm">
              Les deux documentations sont prêtes. Lance la fusion IA pour obtenir un document unique, réconcilié
              à partir du Word et du JXML.
            </p>
            <button
              type="button"
              onClick={handleMergeClick}
              className="bg-gl-orange hover:bg-gl-orange-dark text-white font-semibold text-lg py-4 px-8 rounded-lg shadow-md transition-colors duration-150"
            >
              Fusionner Word ⇄ JXML
            </button>
            {error && <span className="text-sm text-gl-danger">{error}</span>}
          </div>
        ) : (
          <div className="flex flex-col min-h-0 flex-1 gap-2">
            {error && <span className="text-sm text-gl-danger shrink-0">{error}</span>}
            <MarkdownView value={merged} onChange={setMerged} placeholder="" />
          </div>
        )}
      </section>
    </>
  )
}

export default MergePanel
