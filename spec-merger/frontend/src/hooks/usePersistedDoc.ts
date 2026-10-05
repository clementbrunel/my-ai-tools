import { useCallback, useState } from 'react'
import { updateDocument } from '../api/analysis'

/** The only shape this hook actually cares about from a generate/merge/restore result — deliberately
 * narrower than {@link import('../types').SpecGenerationResult}, whose other fields (e.g.
 * `sessionId`) are the concern of {@link useGenerationSession}, not of a single document slot. */
interface GeneratedDoc {
  id: string
  markdown: string
}

/**
 * One persisted document slot (the Word spec, the JXML spec, or their merge): its id and current
 * markdown. Manual edits are local until explicitly saved — `isDirty` tells a panel when to show
 * a save button, `save()` persists the current markdown as a new revision. Used both directly by
 * a panel and by {@link useGenerationSession} to restore a whole session.
 */
export function usePersistedDoc() {
  const [id, setId] = useState<string | null>(null)
  const [markdown, setMarkdown] = useState('')
  const [savedMarkdown, setSavedMarkdown] = useState('')
  const [saving, setSaving] = useState(false)

  /** Call once a generate/merge API call resolves — the result is saved by definition. */
  const onGenerated = useCallback((result: GeneratedDoc) => {
    setId(result.id)
    setMarkdown(result.markdown)
    setSavedMarkdown(result.markdown)
  }, [])

  /** Call on every edit — purely local, no network call; see `save`. */
  const onEdit = useCallback((next: string) => {
    setMarkdown(next)
  }, [])

  /** Call when restoring a session from a persisted id — same effect as onGenerated, named for
   * clarity at the call site. */
  const restore = onGenerated

  /** Persists the current markdown as a new revision (never overwrites — see backend). Throws on
   * failure so the caller can surface its own error message. */
  const save = useCallback(async () => {
    if (!id) return
    setSaving(true)
    try {
      const result = await updateDocument(id, markdown)
      setSavedMarkdown(result.markdown)
    } finally {
      setSaving(false)
    }
  }, [id, markdown])

  const isDirty = markdown !== savedMarkdown

  return { id, markdown, isDirty, saving, onGenerated, onEdit, restore, save }
}

export type PersistedDoc = ReturnType<typeof usePersistedDoc>
