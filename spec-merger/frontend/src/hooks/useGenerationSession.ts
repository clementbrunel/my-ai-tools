import { useEffect, useRef, useState } from 'react'
import { getDocument, getSession, linkDocuments } from '../api/analysis'
import type { GitlabSelection } from '../types'
import { usePersistedDoc } from './usePersistedDoc'

const STORAGE_KEY = 'spec-merger-session'

interface StoredSession {
  wordDocumentId?: string
  jxmlDocumentId?: string
  mergedDocumentId?: string
  gitlabSelection?: GitlabSelection
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
 * Loads a session exported from another machine — by any one of its document ids: a finished
 * merge, or a lone Word/JXML generation with no counterpart to merge with yet (see the navbar's
 * "Exporter"/"Charger une session" controls) — and reloads the page. Writing the ids to
 * localStorage and reloading, rather than pushing the fetched state into this hook directly,
 * reuses the exact same restore path a normal reload takes — including CodePanel's GitLab
 * selection replay — instead of duplicating that logic here for a one-off case.
 */
export async function importSession(documentId: string): Promise<void> {
  const session = await getSession(documentId)
  const stored: StoredSession = {
    wordDocumentId: session.wordDocumentId ?? undefined,
    jxmlDocumentId: session.jxmlDocumentId ?? undefined,
    mergedDocumentId: session.mergedDocumentId ?? undefined,
    gitlabSelection: session.gitlabSelectionJson
      ? (JSON.parse(session.gitlabSelectionJson) as GitlabSelection)
      : undefined,
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
  window.location.reload()
}

/**
 * Clears the current session (the 3 document slots + the GitLab selection) and reloads, for a
 * clean slate once the user is done working — the navbar's "Nouvelle session" control. The
 * underlying documents are never deleted server-side (their revisions stay reachable by id, or
 * via a previously exported session id) — this only drops the local pointers to them.
 */
export function resetSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // localStorage unavailable — nothing was persisted to begin with.
  }
  window.location.reload()
}

/**
 * The cross-cutting session state: the three document slots (Word spec, JXML spec, merge) and
 * their persisted ids, restored from localStorage on mount by fetching each document's latest
 * content back from the backend — see #263. The GitLab source-selection fields (repo, entry
 * point, selected paths) are persisted the same way; `initialGitlabSelection` is the value read
 * from storage at mount, for CodePanel to replay its GitLab loading flow with, and
 * `setGitlabSelection` is how CodePanel reports the selection back as it changes — see #326.
 */
export function useGenerationSession() {
  const word = usePersistedDoc()
  const jxml = usePersistedDoc()
  const merged = usePersistedDoc()
  const stored = useRef(loadStoredSession()).current
  const [restoring, setRestoring] = useState(
    Boolean(stored.wordDocumentId || stored.jxmlDocumentId || stored.mergedDocumentId),
  )
  const [gitlabSelection, setGitlabSelection] = useState<GitlabSelection | null>(
    stored.gitlabSelection ?? null,
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
    // While a restore is in flight, word/jxml/merged ids are still null (the getDocument calls
    // haven't resolved yet) — persisting now would clobber the very session being restored with
    // nulls, before it's even had a chance to load. Wait for restoreAll() to finish (sets
    // restoring to false) before this effect is allowed to write anything.
    if (restoring) return
    const session: StoredSession = {
      wordDocumentId: word.id ?? undefined,
      jxmlDocumentId: jxml.id ?? undefined,
      mergedDocumentId: merged.id ?? undefined,
      gitlabSelection: gitlabSelection ?? undefined,
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    } catch {
      // localStorage unavailable — the session just won't survive a reload.
    }
  }, [word.id, jxml.id, merged.id, gitlabSelection, restoring])

  useEffect(() => {
    // Pairs the Word and JXML documents server-side as soon as both exist, so the session becomes
    // recoverable (see getSession) from either one's id alone even if the user never merges them.
    // Runs again whenever either id changes (one side regenerated) — idempotent on the backend, so
    // re-linking an already-current pair (e.g. right after a restore) is harmless. Skipped while
    // restoring since that's just replaying an already-linked (or intentionally unlinked) pair.
    if (restoring) return
    if (!word.id || !jxml.id) return
    linkDocuments(word.id, jxml.id).catch((e) => {
      console.error('Échec du rattachement Word/JXML de la session', e)
    })
  }, [word.id, jxml.id, restoring])

  return {
    word,
    jxml,
    merged,
    restoring,
    gitlabSelection,
    initialGitlabSelection: stored.gitlabSelection ?? null,
    setGitlabSelection,
  }
}
