import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { importSession, resetSession, useGenerationSession } from './useGenerationSession'
import { getDocument, getSession, linkDocuments } from '../api/analysis'

vi.mock('../api/analysis', () => ({
  getDocument: vi.fn(),
  getSession: vi.fn(),
  linkDocuments: vi.fn(),
  updateDocument: vi.fn(),
}))

const getDocumentMock = vi.mocked(getDocument)
const getSessionMock = vi.mocked(getSession)
const linkDocumentsMock = vi.mocked(linkDocuments)
const STORAGE_KEY = 'spec-merger-session'

beforeEach(() => {
  getDocumentMock.mockReset()
  getSessionMock.mockReset()
  linkDocumentsMock.mockReset()
  linkDocumentsMock.mockResolvedValue(undefined)
  localStorage.clear()
})

describe('useGenerationSession', () => {
  it('starts empty and not restoring when localStorage has no session', () => {
    const { result } = renderHook(() => useGenerationSession())
    expect(result.current.restoring).toBe(false)
    expect(result.current.word.id).toBeNull()
    expect(result.current.jxml.id).toBeNull()
    expect(result.current.merged.id).toBeNull()
    expect(getDocumentMock).not.toHaveBeenCalled()
  })

  it('restores all three documents from a stored session', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ wordDocumentId: 'word-1', jxmlDocumentId: 'jxml-1', mergedDocumentId: 'merged-1' }),
    )
    getDocumentMock.mockImplementation(async (id: string) => ({ id, markdown: `# ${id}` }))

    const { result } = renderHook(() => useGenerationSession())
    expect(result.current.restoring).toBe(true)

    await waitFor(() => expect(result.current.restoring).toBe(false))

    expect(result.current.word).toMatchObject({ id: 'word-1', markdown: '# word-1' })
    expect(result.current.jxml).toMatchObject({ id: 'jxml-1', markdown: '# jxml-1' })
    expect(result.current.merged).toMatchObject({ id: 'merged-1', markdown: '# merged-1' })
  })

  it('restores only the documents present in the stored session', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ wordDocumentId: 'word-1' }))
    getDocumentMock.mockResolvedValue({ id: 'word-1', markdown: '# Word' })

    const { result } = renderHook(() => useGenerationSession())
    await waitFor(() => expect(result.current.restoring).toBe(false))

    expect(getDocumentMock).toHaveBeenCalledTimes(1)
    expect(getDocumentMock).toHaveBeenCalledWith('word-1')
    expect(result.current.word.id).toBe('word-1')
    expect(result.current.jxml.id).toBeNull()
    expect(result.current.merged.id).toBeNull()
  })

  it('stops restoring even if fetching a stored document fails', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ wordDocumentId: 'gone' }))
    getDocumentMock.mockRejectedValue(new Error('Document introuvable'))
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { result } = renderHook(() => useGenerationSession())
    await waitFor(() => expect(result.current.restoring).toBe(false))

    expect(result.current.word.id).toBeNull()
    consoleErrorSpy.mockRestore()
  })

  it('persists document ids to localStorage as they are generated', () => {
    const { result } = renderHook(() => useGenerationSession())

    act(() => result.current.word.onGenerated({ id: 'word-1', markdown: '# Word' }))

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored.wordDocumentId).toBe('word-1')
    expect(stored.jxmlDocumentId).toBeUndefined()
  })

  it('does not link while only one of the Word/JXML slots is filled', () => {
    const { result } = renderHook(() => useGenerationSession())

    act(() => result.current.word.onGenerated({ id: 'word-1', markdown: '# Word' }))

    expect(linkDocumentsMock).not.toHaveBeenCalled()
  })

  it('links the Word and JXML documents once both slots are filled', async () => {
    const { result } = renderHook(() => useGenerationSession())

    act(() => result.current.word.onGenerated({ id: 'word-1', markdown: '# Word' }))
    act(() => result.current.jxml.onGenerated({ id: 'jxml-1', markdown: '# JXML' }))

    await waitFor(() => expect(linkDocumentsMock).toHaveBeenCalledWith('word-1', 'jxml-1'))
  })

  it('re-links when one side is regenerated while the other still exists', async () => {
    const { result } = renderHook(() => useGenerationSession())

    act(() => result.current.word.onGenerated({ id: 'word-1', markdown: '# Word' }))
    act(() => result.current.jxml.onGenerated({ id: 'jxml-1', markdown: '# JXML' }))
    await waitFor(() => expect(linkDocumentsMock).toHaveBeenCalledWith('word-1', 'jxml-1'))

    act(() => result.current.word.onGenerated({ id: 'word-2', markdown: '# Word v2' }))

    await waitFor(() => expect(linkDocumentsMock).toHaveBeenCalledWith('word-2', 'jxml-1'))
  })

  it('links only after a restore finishes, not while both ids are still resolving', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ wordDocumentId: 'word-1', jxmlDocumentId: 'jxml-1' }),
    )
    let resolveWord: (result: { id: string; markdown: string }) => void = () => {}
    getDocumentMock.mockImplementation((id: string) => {
      if (id === 'word-1') return new Promise((resolve) => { resolveWord = resolve })
      return Promise.resolve({ id, markdown: `# ${id}` })
    })

    const { result } = renderHook(() => useGenerationSession())
    await waitFor(() => expect(result.current.jxml.id).toBe('jxml-1'))
    // word.id hasn't resolved yet (still restoring) — must not have linked prematurely.
    expect(linkDocumentsMock).not.toHaveBeenCalled()

    resolveWord({ id: 'word-1', markdown: '# Word' })
    await waitFor(() => expect(result.current.restoring).toBe(false))

    // Both slots came from a restore, not a fresh generation — linking still runs once restoring
    // clears, re-affirming the pairing (harmless, since it's idempotent server-side).
    expect(linkDocumentsMock).toHaveBeenCalledWith('word-1', 'jxml-1')
  })

  it('exposes a stored GitLab selection as initialGitlabSelection', () => {
    const gitlabSelection = {
      groupKey: 'jway-forms',
      projectId: '1',
      entryPointPath: 'forms/demarche_un.jxml',
      selectedPaths: ['forms/kyc.jxml'],
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ gitlabSelection }))

    const { result } = renderHook(() => useGenerationSession())

    expect(result.current.initialGitlabSelection).toEqual(gitlabSelection)
  })

  it('persists the GitLab selection reported via setGitlabSelection', () => {
    const { result } = renderHook(() => useGenerationSession())

    const gitlabSelection = {
      groupKey: 'jway-forms',
      projectId: '1',
      entryPointPath: 'forms/demarche_un.jxml',
      selectedPaths: ['forms/kyc.jxml'],
    }
    act(() => result.current.setGitlabSelection(gitlabSelection))

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored.gitlabSelection).toEqual(gitlabSelection)
  })

  it('clears the persisted GitLab selection when setGitlabSelection(null) is reported', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        gitlabSelection: {
          groupKey: 'jway-forms',
          projectId: '1',
          entryPointPath: 'forms/demarche_un.jxml',
          selectedPaths: [],
        },
      }),
    )
    const { result } = renderHook(() => useGenerationSession())

    act(() => result.current.setGitlabSelection(null))

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored.gitlabSelection).toBeUndefined()
  })

  it('does not clobber the stored session with nulls while a restore is still in flight', async () => {
    // Regression test: the persist effect used to fire on mount before the async getDocument
    // calls resolved (word/jxml/merged ids were still null then), overwriting the very session
    // being restored — permanently losing it if the tab closed before the restore finished.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ wordDocumentId: 'word-1', jxmlDocumentId: 'jxml-1', mergedDocumentId: 'merged-1' }),
    )
    let resolveWord: (result: { id: string; markdown: string }) => void = () => {}
    getDocumentMock.mockImplementation((id: string) => {
      if (id === 'word-1') return new Promise((resolve) => { resolveWord = resolve })
      return Promise.resolve({ id, markdown: `# ${id}` })
    })

    const { result } = renderHook(() => useGenerationSession())
    expect(result.current.restoring).toBe(true)

    // jxml/merged have already resolved, but word (and thus the whole restore) hasn't — the
    // stored session must still be intact on disk at this point, not wiped to nulls.
    await waitFor(() => expect(result.current.jxml.id).toBe('jxml-1'))
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual({
      wordDocumentId: 'word-1',
      jxmlDocumentId: 'jxml-1',
      mergedDocumentId: 'merged-1',
    })

    resolveWord({ id: 'word-1', markdown: '# Word' })
    await waitFor(() => expect(result.current.restoring).toBe(false))
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual({
      wordDocumentId: 'word-1',
      jxmlDocumentId: 'jxml-1',
      mergedDocumentId: 'merged-1',
    })
  })

  it('exposes the live GitLab selection, not just the one read from storage at mount', () => {
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

  it('stores the fetched session (documents + GitLab selection) and reloads the page', async () => {
    const reloadSpy = stubLocationReload()
    const gitlabSelection = {
      groupKey: 'jway-forms',
      projectId: '1',
      entryPointPath: 'forms/demarche_un.jxml',
      selectedPaths: ['forms/kyc.jxml'],
    }
    getSessionMock.mockResolvedValue({
      mergedDocumentId: 'merged-1',
      mergedMarkdown: '# Fusionné',
      wordDocumentId: 'word-1',
      wordMarkdown: '# Word',
      jxmlDocumentId: 'jxml-1',
      jxmlMarkdown: '# JXML',
      gitlabSelectionJson: JSON.stringify(gitlabSelection),
    })

    await importSession('merged-1')

    expect(getSessionMock).toHaveBeenCalledWith('merged-1')
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual({
      wordDocumentId: 'word-1',
      jxmlDocumentId: 'jxml-1',
      mergedDocumentId: 'merged-1',
      gitlabSelection,
    })
    expect(reloadSpy).toHaveBeenCalled()
  })

  it('omits the GitLab selection when the exported session had none', async () => {
    stubLocationReload()
    getSessionMock.mockResolvedValue({
      mergedDocumentId: 'merged-1',
      mergedMarkdown: '# Fusionné',
      wordDocumentId: null,
      wordMarkdown: null,
      jxmlDocumentId: null,
      jxmlMarkdown: null,
      gitlabSelectionJson: null,
    })

    await importSession('merged-1')

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual({
      mergedDocumentId: 'merged-1',
    })
  })

  it('propagates the error and does not touch localStorage when the fetch fails', async () => {
    getSessionMock.mockRejectedValue(new Error('Document introuvable'))

    await expect(importSession('unknown')).rejects.toThrow('Document introuvable')
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('restores only the Word slot when importing a lone Word document (no merge yet)', async () => {
    stubLocationReload()
    getSessionMock.mockResolvedValue({
      mergedDocumentId: null,
      mergedMarkdown: null,
      wordDocumentId: 'word-1',
      wordMarkdown: '# Word',
      jxmlDocumentId: null,
      jxmlMarkdown: null,
      gitlabSelectionJson: null,
    })

    await importSession('word-1')

    expect(getSessionMock).toHaveBeenCalledWith('word-1')
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual({
      wordDocumentId: 'word-1',
    })
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

  it('clears the stored session and reloads the page', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ wordDocumentId: 'word-1', jxmlDocumentId: 'jxml-1', mergedDocumentId: 'merged-1' }),
    )
    const reloadSpy = stubLocationReload()

    resetSession()

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(reloadSpy).toHaveBeenCalled()
  })
})
