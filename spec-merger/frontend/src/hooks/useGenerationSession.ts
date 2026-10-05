import { useEffect, useRef, useState } from 'react'
import { getSession } from '../api/analysis'
import type { GitlabSelection } from '../types'
import { usePersistedDoc } from './usePersistedDoc'

/** What `trackingOnGenerated` below needs from a generate/merge result — `sessionId` optional so
 * this stays assignable wherever a plain `{id, markdown}` (no session concept) is expected, e.g.
 * a document slot's own `onGenerated`/`restore`. */
interface GeneratedDocWithSession {
  id: string
  markdown: string
  sessionId?: string | null
}

const STORAGE_KEY = 'spec-merger-session-id'

/** `crypto.randomUUID` only exists in secure contexts (HTTPS or localhost) — falls back to
 * `crypto.getRandomValues` (broadly supported, no secure-context restriction) elsewhere. */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`
}

function loadStoredSessionId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    // Private browsing, cleared/blocked site data, etc. — start with no session.
    return null
  }
}

function storeSessionId(sessionId: string | null): void {
  try {
    if (sessionId) localStorage.setItem(STORAGE_KEY, sessionId)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // localStorage unavailable — the session just won't survive a reload.
  }
}

/**
 * Loads a session exported from another machine, by its id (see the navbar's
 * "Exporter"/"Charger une session" controls), and reloads the page. Storing just the id and
 * reloading, rather than pushing the fetched state into this hook directly, reuses the exact
 * same restore path a normal reload takes instead of duplicating that logic here for a one-off
 * case. Fetches the session first so a bad/unknown id fails loudly instead of silently wiping
 * the current session.
 */
export async function importSession(sessionId: string): Promise<void> {
  await getSession(sessionId)
  storeSessionId(sessionId)
  window.location.reload()
}

/**
 * Clears the current session and reloads, for a clean slate once the user is done working — the
 * navbar's "Nouvelle session" control. The underlying session and its documents are never deleted
 * server-side (still reachable by id, e.g. via a previously exported session id) — this only
 * drops the local pointer to it.
 */
export function resetSession(): void {
  storeSessionId(null)
  window.location.reload()
}

/**
 * The cross-cutting session state: a single session id — created server-side as soon as the first
 * document (Word or JXML) is generated, unchanged after — and the three document slots it may
 * carry (Word spec, JXML spec, their merge), restored in one call from the id kept in
 * localStorage. The GitLab source-selection (repo, entry point, selected paths) travels with the
 * session too; `initialGitlabSelection` is what CodePanel replays its GitLab loading flow from —
 * known synchronously at its first mount since the panels aren't rendered until any restore has
 * finished (see App.tsx) — and `setGitlabSelection` is how CodePanel reports the selection back
 * as it changes.
 */
export function useGenerationSession() {
  const word = usePersistedDoc()
  const jxml = usePersistedDoc()
  const merged = usePersistedDoc()
  const storedSessionId = useRef(loadStoredSessionId()).current
  const [sessionId, setSessionId] = useState(storedSessionId)
  const [restoring, setRestoring] = useState(Boolean(storedSessionId))
  const [gitlabSelection, setGitlabSelection] = useState<GitlabSelection | null>(null)
  const initialGitlabSelection = useRef<GitlabSelection | null>(null)

  useEffect(() => {
    if (!storedSessionId) return
    let cancelled = false

    async function restore() {
      try {
        const session = await getSession(storedSessionId as string)
        if (cancelled) return
        if (session.wordDocumentId) {
          word.restore({ id: session.wordDocumentId, markdown: session.wordMarkdown ?? '' })
        }
        if (session.jxmlDocumentId) {
          jxml.restore({ id: session.jxmlDocumentId, markdown: session.jxmlMarkdown ?? '' })
        }
        if (session.mergedDocumentId) {
          merged.restore({ id: session.mergedDocumentId, markdown: session.mergedMarkdown ?? '' })
        }
        if (session.gitlabSelectionJson) {
          const selection = JSON.parse(session.gitlabSelectionJson) as GitlabSelection
          initialGitlabSelection.current = selection
          setGitlabSelection(selection)
        }
      } catch (e) {
        console.error('Échec de la restauration de la session', storedSessionId, e)
      } finally {
        if (!cancelled) setRestoring(false)
      }
    }

    void restore()
    return () => {
      cancelled = true
    }
    // Runs once on mount only — restoring from whatever session id was in localStorage then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    storeSessionId(sessionId)
  }, [sessionId])

  // Mirrors `sessionId` but as a ref, so `claimSessionId` below can mint (and immediately see) a
  // new id synchronously, without waiting for React to commit the corresponding state update —
  // see `claimSessionId`'s own comment for why that matters.
  const sessionIdRef = useRef(sessionId)

  /** Wraps a document slot's onGenerated so every generation also tracks the session it belongs
   * to — the id the frontend actually keeps (see storeSessionId above). */
  function trackingOnGenerated(doc: typeof word) {
    return (result: GeneratedDocWithSession) => {
      doc.onGenerated(result)
      if (result.sessionId) {
        sessionIdRef.current = result.sessionId
        setSessionId(result.sessionId)
      }
    }
  }

  /**
   * Returns the session id to send with a Word or JXML generation request, minting one
   * client-side on first use instead of leaving the backend to mint one once the request lands.
   * This matters because two generations (Word and JXML) can be fired one right after the other,
   * before either response comes back — if both requests went out with no session id, the backend
   * would create two separate sessions and whichever response arrives last would silently win,
   * orphaning the other document. Claiming the id here — a synchronous ref read-then-write, not
   * React state — means the second call sees the first's claim immediately, so both requests
   * always carry the same id and land on the same session.
   */
  function claimSessionId(): string {
    if (!sessionIdRef.current) {
      sessionIdRef.current = generateUUID()
      setSessionId(sessionIdRef.current)
    }
    return sessionIdRef.current
  }

  return {
    word: { ...word, onGenerated: trackingOnGenerated(word) },
    jxml: { ...jxml, onGenerated: trackingOnGenerated(jxml) },
    merged: { ...merged, onGenerated: trackingOnGenerated(merged) },
    restoring,
    gitlabSelection,
    initialGitlabSelection: initialGitlabSelection.current,
    setGitlabSelection,
    sessionId,
    claimSessionId,
  }
}
