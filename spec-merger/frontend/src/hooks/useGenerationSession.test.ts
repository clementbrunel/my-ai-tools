import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { importSession, resetSession, useGenerationSession } from './useGenerationSession'
import { getSession } from '../api/analysis'

vi.mock('../api/analysis', () => ({
  getSession: vi.fn(),
  updateDocument: vi.fn(),
}))

const getSessionMock = vi.mocked(getSession)
const STORAGE_KEY = 'spec-merger-session-id'

function emptySessionExport(sessionId: string) {
  return {
    sessionId,
    wordDocumentId: null,
    wordMarkdown: null,
    jxmlDocumentId: null,
    jxmlMarkdown: null,
    mergedDocumentId: null,
    mergedMarkdown: null,
    gitlabSelectionJson: null,
  }
}

beforeEach(() => {
  getSessionMock.mockReset()
  localStorage.clear()
})

describe('useGenerationSession', () => {
  it('starts empty and not restoring when localStorage has no session', () => {
    const { result } = renderHook(() => useGenerationSession())
    expect(result.current.restoring).toBe(false)
    expect(result.current.sessionId).toBeNull()
    expect(result.current.word.id).toBeNull()
    expect(result.current.jxml.id).toBeNull()
    expect(result.current.merged.id).toBeNull()
    expect(getSessionMock).not.toHaveBeenCalled()
  })

  it('restores all three documents from a stored session id in one call', async () => {
    localStorage.setItem(STORAGE_KEY, 'session-1')
    getSessionMock.mockResolvedValue({
      ...emptySessionExport('session-1'),
      wordDocumentId: 'word-1',
      wordMarkdown: '# word-1',
      jxmlDocumentId: 'jxml-1',
      jxmlMarkdown: '# jxml-1',
      mergedDocumentId: 'merged-1',
      mergedMarkdown: '# merged-1',
    })

    const { result } = renderHook(() => useGenerationSession())
    expect(result.current.restoring).toBe(true)

    await waitFor(() => expect(result.current.restoring).toBe(false))

    expect(getSessionMock).toHaveBeenCalledWith('session-1')
    expect(result.current.sessionId).toBe('session-1')
    expect(result.current.word).toMatchObject({ id: 'word-1', markdown: '# word-1' })
    expect(result.current.jxml).toMatchObject({ id: 'jxml-1', markdown: '# jxml-1' })
    expect(result.current.merged).toMatchObject({ id: 'merged-1', markdown: '# merged-1' })
  })

  it('restores only the slots present in the session (no merge yet)', async () => {
    localStorage.setItem(STORAGE_KEY, 'session-1')
    getSessionMock.mockResolvedValue({
      ...emptySessionExport('session-1'),
      wordDocumentId: 'word-1',
      wordMarkdown: '# Word',
    })

    const { result } = renderHook(() => useGenerationSession())
    await waitFor(() => expect(result.current.restoring).toBe(false))

    expect(result.current.word.id).toBe('word-1')
    expect(result.current.jxml.id).toBeNull()
    expect(result.current.merged.id).toBeNull()
  })

  it('stops restoring even if fetching the stored session fails', async () => {
    localStorage.setItem(STORAGE_KEY, 'gone')
    getSessionMock.mockRejectedValue(new Error('Session introuvable'))
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { result } = renderHook(() => useGenerationSession())
    await waitFor(() => expect(result.current.restoring).toBe(false))

    expect(result.current.word.id).toBeNull()
    consoleErrorSpy.mockRestore()
  })

  it('tracks the session id returned by a generation, and persists it to localStorage', () => {
    const { result } = renderHook(() => useGenerationSession())

    act(() => result.current.word.onGenerated({ id: 'word-1', markdown: '# Word', sessionId: 'session-1' }))

    expect(result.current.sessionId).toBe('session-1')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('session-1')
  })

  it('still sets the document slot even though the session id is unchanged on a second generation', () => {
    const { result } = renderHook(() => useGenerationSession())

    act(() => result.current.word.onGenerated({ id: 'word-1', markdown: '# Word', sessionId: 'session-1' }))
    act(() => result.current.jxml.onGenerated({ id: 'jxml-1', markdown: '# JXML', sessionId: 'session-1' }))

    expect(result.current.sessionId).toBe('session-1')
    expect(result.current.word.id).toBe('word-1')
    expect(result.current.jxml.id).toBe('jxml-1')
  })

  it('claimSessionId mints a new id once and returns the same one on later calls', () => {
    const { result } = renderHook(() => useGenerationSession())

    let claimed1 = ''
    let claimed2 = ''
    act(() => {
      claimed1 = result.current.claimSessionId()
      claimed2 = result.current.claimSessionId()
    })

    expect(claimed1).toBe(claimed2)
    expect(result.current.sessionId).toBe(claimed1)
  })

  it('claimSessionId lets two near-simultaneous first generations share one session id', () => {
    // Regression test: Word and JXML generation used to each omit sessionId until their own
    // response came back, so firing both before either resolved raced into two separate backend
    // sessions. claimSessionId mints the id up front (synchronously) so both requests carry it.
    const { result } = renderHook(() => useGenerationSession())

    let wordSessionId = ''
    let jxmlSessionId = ''
    act(() => {
      wordSessionId = result.current.claimSessionId()
      jxmlSessionId = result.current.claimSessionId()
    })

    expect(wordSessionId).toBe(jxmlSessionId)
  })

  it('claimSessionId reuses the session id already known from a prior generation', () => {
    const { result } = renderHook(() => useGenerationSession())

    act(() => result.current.word.onGenerated({ id: 'word-1', markdown: '# Word', sessionId: 'session-1' }))

    let claimed = ''
    act(() => {
      claimed = result.current.claimSessionId()
    })

    expect(claimed).toBe('session-1')
  })

  it('exposes a stored GitLab selection as initialGitlabSelection once restored', async () => {
    localStorage.setItem(STORAGE_KEY, 'session-1')
    const gitlabSelection = {
      groupKey: 'jway-forms',
      projectId: '1',
      entryPointPath: 'forms/demarche_un.jxml',
      selectedPaths: ['forms/kyc.jxml'],
    }
    getSessionMock.mockResolvedValue({
      ...emptySessionExport('session-1'),
      gitlabSelectionJson: JSON.stringify(gitlabSelection),
    })

    const { result } = renderHook(() => useGenerationSession())
    await waitFor(() => expect(result.current.restoring).toBe(false))

    expect(result.current.initialGitlabSelection).toEqual(gitlabSelection)
    expect(result.current.gitlabSelection).toEqual(gitlabSelection)
  })

  it('exposes the live GitLab selection reported via setGitlabSelection', () => {
    const { result } = renderHook(() => useGenerationSession())
    expect(result.current.gitlabSelection).toBeNull()

    const gitlabSelection = {
      groupKey: 'jway-forms',
      projectId: '1',
      entryPointPath: 'forms/demarche_un.jxml',
      selectedPaths: [],
    }
    act(() => result.current.setGitlabSelection(gitlabSelection))

    expect(result.current.gitlabSelection).toEqual(gitlabSelection)
  })
})

// jsdom's window.location.reload is non-configurable, so vi.spyOn can't touch it directly —
// replace the whole `location` object instead (its own property on window is configurable).
function stubLocationReload(): ReturnType<typeof vi.fn> {
  const reloadSpy = vi.fn()
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, reload: reloadSpy },
  })
  return reloadSpy
}

describe('importSession', () => {
  const originalLocation = window.location

  beforeEach(() => {
    getSessionMock.mockReset()
    localStorage.clear()
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
  })

  it('fetches the session to validate it, then stores the id and reloads the page', async () => {
    const reloadSpy = stubLocationReload()
    getSessionMock.mockResolvedValue(emptySessionExport('session-1'))

    await importSession('session-1')

    expect(getSessionMock).toHaveBeenCalledWith('session-1')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('session-1')
    expect(reloadSpy).toHaveBeenCalled()
  })

  it('propagates the error and does not touch localStorage when the fetch fails', async () => {
    getSessionMock.mockRejectedValue(new Error('Session introuvable'))

    await expect(importSession('unknown')).rejects.toThrow('Session introuvable')
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})

describe('resetSession', () => {
  const originalLocation = window.location

  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
  })

  it('clears the stored session id and reloads the page', () => {
    localStorage.setItem(STORAGE_KEY, 'session-1')
    const reloadSpy = stubLocationReload()

    resetSession()

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(reloadSpy).toHaveBeenCalled()
  })
})
