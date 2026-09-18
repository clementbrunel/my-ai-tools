import { useCallback, useEffect, useRef, useState } from 'react'
import { updateDocument } from '../api/analysis'
import type { SpecGenerationResult } from '../types'

const AUTOSAVE_DEBOUNCE_MS = 1000

/**
 * One persisted document slot (the Word spec, the JXML spec, or their merge): its id and current
 * markdown, plus manual edits auto-saved (debounced) as new revisions once the document exists.
 * Used both directly by a panel and by {@link useGenerationSession} to restore a whole session.
 */
export function usePersistedDoc() {
  const [id, setId] = useState<string | null>(null)
  const [markdown, setMarkdown] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  /** Call once a generate/merge API call resolves. */
  const onGenerated = useCallback((result: SpecGenerationResult) => {
    setId(result.id)
    setMarkdown(result.markdown)
  }, [])

  /** Call on every edit — updates immediately, auto-saves (debounced) once the doc has an id. */
  const onEdit = useCallback(
    (next: string) => {
      setMarkdown(next)
      if (!id) return
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        updateDocument(id, next).catch((e) => console.error('Échec de la sauvegarde automatique', e))
      }, AUTOSAVE_DEBOUNCE_MS)
    },
    [id],
  )

  /** Call when restoring a session from a persisted id — same effect as onGenerated, named for
   * clarity at the call site (no auto-save triggered either way). */
  const restore = onGenerated

  return { id, markdown, onGenerated, onEdit, restore }
}

export type PersistedDoc = ReturnType<typeof usePersistedDoc>
