import { act, renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { usePersistedDoc } from './usePersistedDoc'
import { updateDocument } from '../api/analysis'

vi.mock('../api/analysis', () => ({
  updateDocument: vi.fn(),
}))

const updateDocumentMock = vi.mocked(updateDocument)

beforeEach(() => {
  updateDocumentMock.mockReset()
})

describe('usePersistedDoc', () => {
  it('starts with no id, empty markdown, and not dirty', () => {
    const { result } = renderHook(() => usePersistedDoc())
    expect(result.current.id).toBeNull()
    expect(result.current.markdown).toBe('')
    expect(result.current.isDirty).toBe(false)
  })

  it('onGenerated sets the id and markdown from a generation result, not dirty', () => {
    const { result } = renderHook(() => usePersistedDoc())
    act(() => result.current.onGenerated({ id: 'doc-1', markdown: '# Doc' }))
    expect(result.current.id).toBe('doc-1')
    expect(result.current.markdown).toBe('# Doc')
    expect(result.current.isDirty).toBe(false)
  })

  it('restore sets the id and markdown, not dirty, without calling the API', () => {
    const { result } = renderHook(() => usePersistedDoc())
    act(() => result.current.restore({ id: 'doc-1', markdown: '# Restauré' }))
    expect(result.current.id).toBe('doc-1')
    expect(result.current.markdown).toBe('# Restauré')
    expect(result.current.isDirty).toBe(false)
    expect(updateDocumentMock).not.toHaveBeenCalled()
  })

  it('onEdit updates the markdown and marks it dirty, without calling the API', () => {
    const { result } = renderHook(() => usePersistedDoc())
    act(() => result.current.onGenerated({ id: 'doc-1', markdown: '# Doc' }))
    act(() => result.current.onEdit('# Doc édité'))
    expect(result.current.markdown).toBe('# Doc édité')
    expect(result.current.isDirty).toBe(true)
    expect(updateDocumentMock).not.toHaveBeenCalled()
  })

  it('editing back to the last saved content is no longer dirty', () => {
    const { result } = renderHook(() => usePersistedDoc())
    act(() => result.current.onGenerated({ id: 'doc-1', markdown: '# Doc' }))
    act(() => result.current.onEdit('# Doc édité'))
    act(() => result.current.onEdit('# Doc'))
    expect(result.current.isDirty).toBe(false)
  })

  it('save persists the current markdown and clears the dirty flag', async () => {
    updateDocumentMock.mockResolvedValue({ id: 'doc-1', markdown: '# Doc édité' })
    const { result } = renderHook(() => usePersistedDoc())
    act(() => result.current.onGenerated({ id: 'doc-1', markdown: '# Doc' }))
    act(() => result.current.onEdit('# Doc édité'))

    await act(() => result.current.save())

    expect(updateDocumentMock).toHaveBeenCalledWith('doc-1', '# Doc édité')
    expect(result.current.isDirty).toBe(false)
  })

  it('sets saving while the save call is in flight', async () => {
    let resolveSave: (result: { id: string; markdown: string }) => void = () => {}
    updateDocumentMock.mockReturnValue(new Promise((resolve) => { resolveSave = resolve }))
    const { result } = renderHook(() => usePersistedDoc())
    act(() => result.current.onGenerated({ id: 'doc-1', markdown: '# Doc' }))
    act(() => result.current.onEdit('# Doc édité'))

    let savePromise!: Promise<void>
    act(() => {
      savePromise = result.current.save()
    })
    expect(result.current.saving).toBe(true)

    await act(async () => {
      resolveSave({ id: 'doc-1', markdown: '# Doc édité' })
      await savePromise
    })
    expect(result.current.saving).toBe(false)
  })

  it('save is a no-op without an id', async () => {
    const { result } = renderHook(() => usePersistedDoc())
    await act(() => result.current.save())
    expect(updateDocumentMock).not.toHaveBeenCalled()
  })

  it('leaves isDirty true and rethrows when save fails', async () => {
    updateDocumentMock.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => usePersistedDoc())
    act(() => result.current.onGenerated({ id: 'doc-1', markdown: '# Doc' }))
    act(() => result.current.onEdit('# Doc édité'))

    await expect(act(() => result.current.save())).rejects.toThrow('boom')
    expect(result.current.isDirty).toBe(true)
    expect(result.current.saving).toBe(false)
  })
})
