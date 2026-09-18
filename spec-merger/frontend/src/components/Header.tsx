import { useEffect, useState } from 'react'
import ConfirmDialog from './ConfirmDialog'

interface HeaderProps {
  /** The merged document's id, once a merge has completed — kept in sync with the session-id
   * field below (including right after `onImportSession` reloads the page with a different one). */
  mergedDocumentId: string | null
  /** Whether any of the 3 document slots currently holds something — shows "Nouvelle session". */
  hasSession: boolean
  /** Loads a session (the 3 documents + the GitLab project selection) exported from another
   * machine, given the merged document id it was exported as. Throws on failure. */
  onImportSession: (mergedDocumentId: string) => Promise<void>
  /** Clears the current session for a clean slate — see `resetSession`. */
  onReset: () => void
}

function Header({ mergedDocumentId, hasSession, onImportSession, onReset }: HeaderProps) {
  // Always mirrors mergedDocumentId — a merge, or loading a different session (which reloads the
  // page with the new id), both flow back here — but stays freely editable so the user can paste
  // a different session's id to load in its place.
  const [sessionId, setSessionId] = useState(mergedDocumentId ?? '')
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmingReset, setConfirmingReset] = useState(false)

  useEffect(() => {
    setSessionId(mergedDocumentId ?? '')
  }, [mergedDocumentId])

  async function handleCopy() {
    const id = sessionId.trim()
    if (!id) return
    try {
      await navigator.clipboard.writeText(id)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      setError('Échec de la copie — voir la console.')
      console.error(e)
    }
  }

  async function handleLoad() {
    const id = sessionId.trim()
    // Also guards Enter-key submission, which the disabled submit button alone doesn't block.
    if (!id || id === (mergedDocumentId ?? '')) return
    setError(null)
    setLoading(true)
    try {
      await onImportSession(id)
      // No need to reset loading on success — onImportSession reloads the page.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec du chargement de la session — voir la console.')
      console.error(e)
      setLoading(false)
    }
  }

  function handleReset() {
    setConfirmingReset(true)
  }

  function handleConfirmReset() {
    setConfirmingReset(false)
    onReset()
  }

  return (
    <header className="flex items-center gap-3 px-4 py-3 bg-gl-dark shadow-sm">
      <div className="flex items-center gap-2 shrink-0">
        <img src="/favicon.svg" alt="" className="h-6 w-6 shrink-0" />
        <span className="text-white font-semibold text-sm">Spec Doc/JXML Merger</span>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-3 shrink-0">
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            void handleLoad()
          }}
        >
          <input
            type="text"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            placeholder="ID de session…"
            title="L'identifiant de la fusion en cours — modifiez-le et cliquez sur Charger pour reprendre une autre session"
            className="w-56 rounded border border-white/20 bg-white/5 px-2 py-1.5 text-xs text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gl-orange"
          />
          <button
            type="button"
            onClick={handleCopy}
            title="Copier l'identifiant dans le presse-papier"
            className="text-xs text-gray-300 hover:text-white border border-white/20 hover:border-white/40 rounded px-2 py-1.5 transition-colors disabled:opacity-40"
            disabled={!sessionId.trim()}
          >
            {copied ? 'Copié ✓' : 'Copier'}
          </button>
          <button
            type="submit"
            className="text-xs text-gray-300 hover:text-white border border-white/20 hover:border-white/40 rounded px-2 py-1.5 transition-colors disabled:opacity-50"
            disabled={loading || !sessionId.trim() || sessionId.trim() === (mergedDocumentId ?? '')}
          >
            {loading ? 'Chargement…' : 'Charger'}
          </button>
        </form>
        {error && (
          <span className="text-xs text-gl-danger max-w-xs truncate" title={error}>
            {error}
          </span>
        )}
        {hasSession && (
          <button
            type="button"
            onClick={handleReset}
            title="Effacer la session en cours et repartir de zéro"
            className="text-xs text-gray-300 hover:text-gl-danger border border-white/20 hover:border-gl-danger rounded px-2 py-1.5 transition-colors"
          >
            Nouvelle session
          </button>
        )}
      </div>
      <ConfirmDialog
        open={confirmingReset}
        title="Nouvelle session"
        message="Repartir d'une session vierge ? Les documents actuels resteront accessibles avec leur identifiant si vous l'avez copié, mais disparaîtront de l'interface."
        confirmLabel="Repartir de zéro"
        danger
        onConfirm={handleConfirmReset}
        onCancel={() => setConfirmingReset(false)}
      />
    </header>
  )
}

export default Header
