import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useGenerationSession } from './useGenerationSession'
import { getDocument } from '../api/analysis'

vi.mock('../api/analysis', () => ({
  getDocument: vi.fn(),
  updateDocument: vi.fn(),
}))

const getDocumentMock = vi.mocked(getDocument)
const STORAGE_KEY = 'spec-merger-session'

beforeEach(() => {
  getDocumentMock.mockReset()
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
})
