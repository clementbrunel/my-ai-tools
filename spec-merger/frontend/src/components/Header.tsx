import { useState } from 'react'

interface HeaderProps {
  /** The merged document's id, once a merge has completed — what "Exporter" hands out. */
  mergedDocumentId: string | null
  /** Loads a session (the 3 documents + the GitLab project selection) exported from another
   * machine, given the merged document id it was exported as. Throws on failure. */
  onImportSession: (mergedDocumentId: string) => Promise<void>
}

function Header({ mergedDocumentId, onImportSession }: HeaderProps) {
  const [copied, setCopied] = useState(false)
  const [importId, setImportId] = useState('')
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCopy() {
    if (!mergedDocumentId) return
    try {
      await navigator.clipboard.writeText(mergedDocumentId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      setError("Échec de la copie — l'identifiant est affiché ci-dessus.")
      console.error(e)
    }
  }

  async function handleImport() {
    const id = importId.trim()
    if (!id) return
    setError(null)
    setImporting(true)
    try {
      await onImportSession(id)
      // No need to reset importId/importing on success — onImportSession reloads the page.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec du chargement de la session — voir la console.')
      console.error(e)
      setImporting(false)
    }
  }

  return (
    <header className="flex items-center gap-3 px-4 py-3 bg-gl-dark shadow-sm">
      <div className="flex items-center gap-2 shrink-0">
        <span className="h-6 w-6 rounded-sm bg-gradient-to-br from-gl-orange to-gl-orange-dark" />
        <span className="text-white font-semibold text-sm">Spec Doc/JXML Merger</span>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-3 shrink-0">
        {mergedDocumentId && (
          <button
            type="button"
            onClick={handleCopy}
            title="Copier l'identifiant de cette session — à recharger depuis un autre poste via « Charger une session »"
            className="text-xs text-gray-300 hover:text-white border border-white/20 hover:border-white/40 rounded px-2 py-1.5 transition-colors"
          >
            {copied ? 'ID de session copié ✓' : "Exporter l'ID de session"}
          </button>
        )}
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            void handleImport()
          }}
        >
          <input
            type="text"
            value={importId}
            onChange={(e) => setImportId(e.target.value)}
            placeholder="Coller un ID de session…"
            className="w-52 rounded border border-white/20 bg-white/5 px-2 py-1.5 text-xs text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gl-orange"
          />
          <button
            type="submit"
            className="text-xs text-gray-300 hover:text-white border border-white/20 hover:border-white/40 rounded px-2 py-1.5 transition-colors disabled:opacity-50"
            disabled={importing || !importId.trim()}
          >
            {importing ? 'Chargement…' : 'Charger une session'}
          </button>
        </form>
        {error && (
          <span className="text-xs text-gl-danger max-w-xs truncate" title={error}>
            {error}
          </span>
        )}
      </div>
    </header>
  )
}

export default Header
