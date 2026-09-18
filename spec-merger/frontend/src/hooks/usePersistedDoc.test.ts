import { act, renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { usePersistedDoc } from './usePersistedDoc'
import { updateDocument } from '../api/analysis'

vi.mock('../api/analysis', () => ({
  updateDocument: vi.fn(),
}))

const updateDocumentMock = vi.mocked(updateDocument)

beforeEach(() => {
  updateDocumentMock.mockReset()
  updateDocumentMock.mockResolvedValue({ id: 'doc-1', markdown: 'ignored' })
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('usePersistedDoc', () => {
  it('starts with no id and empty markdown', () => {
    const { result } = renderHook(() => usePersistedDoc())
    expect(result.current.id).toBeNull()
    expect(result.current.markdown).toBe('')
  })

  it('onGenerated sets the id and markdown from a generation result', () => {
    const { result } = renderHook(() => usePersistedDoc())
    act(() => result.current.onGenerated({ id: 'doc-1', markdown: '# Doc' }))
    expect(result.current.id).toBe('doc-1')
    expect(result.current.markdown).toBe('# Doc')
  })

  it('restore sets the id and markdown without scheduling an auto-save', () => {
    const { result } = renderHook(() => usePersistedDoc())
    act(() => result.current.restore({ id: 'doc-1', markdown: '# Restauré' }))
    expect(result.current.id).toBe('doc-1')
    expect(result.current.markdown).toBe('# Restauré')
    act(() => vi.advanceTimersByTime(5000))
    expect(updateDocumentMock).not.toHaveBeenCalled()
  })

  it('onEdit updates the markdown immediately but does not auto-save without an id', () => {
    const { result } = renderHook(() => usePersistedDoc())
    act(() => result.current.onEdit('# Édité sans id'))
    expect(result.current.markdown).toBe('# Édité sans id')
    act(() => vi.advanceTimersByTime(5000))
    expect(updateDocumentMock).not.toHaveBeenCalled()
  })

  it('onEdit auto-saves (debounced) once the document has an id', () => {
    const { result } = renderHook(() => usePersistedDoc())
    act(() => result.current.onGenerated({ id: 'doc-1', markdown: '# Doc' }))

    act(() => result.current.onEdit('# Doc édité'))
    expect(updateDocumentMock).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(999))
    expect(updateDocumentMock).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(1))
    expect(updateDocumentMock).toHaveBeenCalledWith('doc-1', '# Doc édité')
    expect(updateDocumentMock).toHaveBeenCalledTimes(1)
  })

  it('debounces rapid successive edits into a single auto-save call', () => {
    const { result } = renderHook(() => usePersistedDoc())
    act(() => result.current.onGenerated({ id: 'doc-1', markdown: '# Doc' }))

    act(() => result.current.onEdit('# a'))
    act(() => vi.advanceTimersByTime(400))
    act(() => result.current.onEdit('# ab'))
    act(() => vi.advanceTimersByTime(400))
    act(() => result.current.onEdit('# abc'))
    act(() => vi.advanceTimersByTime(1000))

    expect(updateDocumentMock).toHaveBeenCalledTimes(1)
    expect(updateDocumentMock).toHaveBeenCalledWith('doc-1', '# abc')
  })
})
