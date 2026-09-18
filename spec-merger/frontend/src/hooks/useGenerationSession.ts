import { useEffect, useRef, useState } from 'react'
import { getDocument } from '../api/analysis'
import { usePersistedDoc } from './usePersistedDoc'

const STORAGE_KEY = 'spec-merger-session'

interface StoredSession {
  wordDocumentId?: string
  jxmlDocumentId?: string
  mergedDocumentId?: string
}

function loadStoredSession(): StoredSession {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StoredSession) : {}
  } catch {
    // Private browsing, cleared/blocked site data, etc. — start with an empty session.
    return {}
  }
}

/**
 * The cross-cutting session state: the three document slots (Word spec, JXML spec, merge) and
 * their persisted ids, restored from localStorage on mount by fetching each document's latest
 * content back from the backend — see #263. GitLab source-selection fields (repo, entry point,
 * selected paths) are intentionally not restored yet; that needs CodePanel to re-run its GitLab
 * loading flow on mount and is tracked separately so this hook stays reviewable.
 */
export function useGenerationSession() {
  const word = usePersistedDoc()
  const jxml = usePersistedDoc()
  const merged = usePersistedDoc()
  const stored = useRef(loadStoredSession()).current
  const [restoring, setRestoring] = useState(
    Boolean(stored.wordDocumentId || stored.jxmlDocumentId || stored.mergedDocumentId),
  )

  useEffect(() => {
    let cancelled = false

    async function restoreDoc(id: string | undefined, target: typeof word) {
      if (!id) return
      try {
        const result = await getDocument(id)
        if (!cancelled) target.restore(result)
      } catch (e) {
        console.error('Échec de la restauration du document', id, e)
      }
    }

    async function restoreAll() {
      await Promise.all([
        restoreDoc(stored.wordDocumentId, word),
        restoreDoc(stored.jxmlDocumentId, jxml),
        restoreDoc(stored.mergedDocumentId, merged),
      ])
      if (!cancelled) setRestoring(false)
    }

    if (restoring) void restoreAll()
    return () => {
      cancelled = true
    }
    // Runs once on mount only — restoring the three slots from whatever was in localStorage then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const session: StoredSession = {
      wordDocumentId: word.id ?? undefined,
      jxmlDocumentId: jxml.id ?? undefined,
      mergedDocumentId: merged.id ?? undefined,
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    } catch {
      // localStorage unavailable — the session just won't survive a reload.
    }
  }, [word.id, jxml.id, merged.id])

  return { word, jxml, merged, restoring }
}
