import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAnalysisSession } from './useAnalysisSession'
import * as api from '../api/analysis'
import type { AnalysisSessionResponse, DocumentVersion } from '../types'

vi.mock('../api/analysis')

const session: AnalysisSessionResponse = {
  id: 's1',
  title: 'Fusion',
  status: 'DRAFT',
  markdown: '# Fusion',
  divergences: [],
}

const versions: DocumentVersion[] = [
  { id: 'v1', versionNumber: 1, source: 'GENERATED', createdAt: '2026-09-16T10:00:00Z' },
]

describe('useAnalysisSession', () => {
  beforeEach(() => {
    vi.mocked(api.createAnalysis).mockReset()
    vi.mocked(api.listVersions).mockReset()
    vi.mocked(api.saveVersion).mockReset()
    vi.mocked(api.restoreVersion).mockReset()
    vi.mocked(api.getAnalysis).mockReset()
  })

  it('starts with an empty state', () => {
    const { result } = renderHook(() => useAnalysisSession())
    expect(result.current.session).toBeNull()
    expect(result.current.markdown).toBe('')
    expect(result.current.versions).toEqual([])
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('analyze sets the session, markdown and versions on success', async () => {
    vi.mocked(api.createAnalysis).mockResolvedValue(session)
    vi.mocked(api.listVersions).mockResolvedValue(versions)
    const { result } = renderHook(() => useAnalysisSession())

    await act(async () => {
      await result.current.analyze({ title: 'Fusion' })
    })

    expect(result.current.session).toEqual(session)
    expect(result.current.markdown).toBe('# Fusion')
    expect(result.current.versions).toEqual(versions)
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('analyze surfaces the backend error message on failure', async () => {
    vi.mocked(api.createAnalysis).mockRejectedValue(new Error('Projet GitLab introuvable'))
    const { result } = renderHook(() => useAnalysisSession())

    await act(async () => {
      await result.current.analyze({})
    })

    expect(result.current.error).toBe('Projet GitLab introuvable')
    expect(result.current.session).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('analyze falls back to a generic message for a non-Error rejection', async () => {
    vi.mocked(api.createAnalysis).mockRejectedValue('boom')
    const { result } = renderHook(() => useAnalysisSession())

    await act(async () => {
      await result.current.analyze({})
    })

    expect(result.current.error).toBe("Échec de l'analyse — voir la console.")
  })

  it('save does nothing without a session', async () => {
    const { result } = renderHook(() => useAnalysisSession())
    await act(async () => {
      await result.current.save()
    })
    expect(api.saveVersion).not.toHaveBeenCalled()
  })

  it('save persists the current markdown and refreshes versions', async () => {
    vi.mocked(api.createAnalysis).mockResolvedValue(session)
    vi.mocked(api.listVersions).mockResolvedValueOnce([]).mockResolvedValueOnce(versions)
    vi.mocked(api.saveVersion).mockResolvedValue(versions[0])
    const { result } = renderHook(() => useAnalysisSession())

    await act(async () => {
      await result.current.analyze({})
    })
    act(() => {
      result.current.setMarkdown('# Edited')
    })
    await act(async () => {
      await result.current.save()
    })

    expect(api.saveVersion).toHaveBeenCalledWith('s1', '# Edited')
    expect(result.current.versions).toEqual(versions)
  })

  it('restore replaces the session, markdown and versions', async () => {
    vi.mocked(api.createAnalysis).mockResolvedValue(session)
    vi.mocked(api.listVersions).mockResolvedValue([])
    const { result } = renderHook(() => useAnalysisSession())
    await act(async () => {
      await result.current.analyze({})
    })

    const restored = { ...session, markdown: '# Restored' }
    vi.mocked(api.restoreVersion).mockResolvedValue(versions[0])
    vi.mocked(api.getAnalysis).mockResolvedValue(restored)
    vi.mocked(api.listVersions).mockResolvedValue(versions)

    await act(async () => {
      await result.current.restore('v1')
    })

    expect(api.restoreVersion).toHaveBeenCalledWith('s1', 'v1')
    expect(result.current.session).toEqual(restored)
    expect(result.current.markdown).toBe('# Restored')
    expect(result.current.versions).toEqual(versions)
  })
})
