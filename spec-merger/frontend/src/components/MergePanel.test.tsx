import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MergePanel from './MergePanel'
import { mergeSpecs, updateDocument } from '../api/analysis'
import { usePersistedDoc } from '../hooks/usePersistedDoc'

vi.mock('../api/analysis', () => ({
  mergeSpecs: vi.fn(),
  updateDocument: vi.fn(),
}))

const mergeSpecsMock = vi.mocked(mergeSpecs)
const updateDocumentMock = vi.mocked(updateDocument)

beforeEach(() => {
  mergeSpecsMock.mockReset()
  updateDocumentMock.mockReset()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

interface RenderOptions {
  wordMarkdown?: string
  jxmlMarkdown?: string
  wordDocumentId?: string | null
  jxmlDocumentId?: string | null
}

/** MergePanel's merged doc is controlled by its parent — this harness stands in for App. */
function renderMergePanel(options: RenderOptions = {}) {
  function Harness() {
    const merged = usePersistedDoc()
    return (
      <MergePanel
        wordMarkdown={options.wordMarkdown ?? ''}
        jxmlMarkdown={options.jxmlMarkdown ?? ''}
        wordDocumentId={options.wordDocumentId ?? null}
        jxmlDocumentId={options.jxmlDocumentId ?? null}
        mergedMarkdown={merged.markdown}
        mergedDocumentId={merged.id}
        onGenerated={merged.onGenerated}
        onEdit={merged.onEdit}
      />
    )
  }
  return render(<Harness />)
}

describe('MergePanel', () => {
  it('shows a waiting message and no button while either doc is missing', () => {
    renderMergePanel()
    expect(screen.getByText(/Génère la doc dans chacun des panneaux/)).toBeDefined()
    expect(screen.queryByText('Fusionner Word ⇄ JXML')).toBeNull()
  })

  it('still waits when only one of the two docs is ready', () => {
    renderMergePanel({ wordMarkdown: '# Word' })
    expect(screen.getByText(/Génère la doc dans chacun des panneaux/)).toBeDefined()
  })

  it('shows the big merge button once both docs are ready', () => {
    renderMergePanel({ wordMarkdown: '# Word', jxmlMarkdown: '# JXML' })
    expect(screen.getByText('Fusionner Word ⇄ JXML')).toBeDefined()
  })

  it('merges the two docs (passing their ids for traceability) and shows the editable result', async () => {
    mergeSpecsMock.mockResolvedValue({ id: 'merged-1', markdown: '# Document fusionné' })
    renderMergePanel({ wordMarkdown: '# Word', jxmlMarkdown: '# JXML', wordDocumentId: 'word-1', jxmlDocumentId: 'jxml-1' })
    await userEvent.click(screen.getByText('Fusionner Word ⇄ JXML'))
    expect(mergeSpecsMock).toHaveBeenCalledWith('# Word', '# JXML', 'word-1', 'jxml-1')
    expect(await screen.findByRole('heading', { level: 1, name: 'Document fusionné' })).toBeDefined()
    expect(screen.getByText('Télécharger')).toBeDefined()
  })

  it('shows an error message when the merge fails', async () => {
    mergeSpecsMock.mockRejectedValue(new Error('Échec de la fusion IA'))
    renderMergePanel({ wordMarkdown: '# Word', jxmlMarkdown: '# JXML' })
    await userEvent.click(screen.getByText('Fusionner Word ⇄ JXML'))
    expect(await screen.findByText('Échec de la fusion IA')).toBeDefined()
  })

  it('re-merges without asking when the result has not been edited', async () => {
    mergeSpecsMock.mockResolvedValue({ id: 'merged-1', markdown: '# v1' })
    renderMergePanel({ wordMarkdown: '# Word', jxmlMarkdown: '# JXML' })
    await userEvent.click(screen.getByText('Fusionner Word ⇄ JXML'))
    await screen.findByText('Refusionner')

    mergeSpecsMock.mockResolvedValue({ id: 'merged-1', markdown: '# v2' })
    await userEvent.click(screen.getByText('Refusionner'))

    expect(window.confirm).not.toHaveBeenCalled()
    expect(await screen.findByRole('heading', { level: 1, name: 'v2' })).toBeDefined()
  })

  it('asks for confirmation before overwriting a manually edited result', async () => {
    mergeSpecsMock.mockResolvedValue({ id: 'merged-1', markdown: '# v1' })
    renderMergePanel({ wordMarkdown: '# Word', jxmlMarkdown: '# JXML' })
    await userEvent.click(screen.getByText('Fusionner Word ⇄ JXML'))
    await screen.findByText('Refusionner')

    await userEvent.click(screen.getByText('Édition'))
    const textarea = screen.getByPlaceholderText('') as HTMLTextAreaElement
    await userEvent.clear(textarea)
    await userEvent.type(textarea, '# v1 édité à la main')

    vi.mocked(window.confirm).mockReturnValue(false)
    mergeSpecsMock.mockResolvedValue({ id: 'merged-1', markdown: '# v2' })
    await userEvent.click(screen.getByText('Refusionner'))

    expect(window.confirm).toHaveBeenCalled()
    expect(mergeSpecsMock).toHaveBeenCalledTimes(1)
    expect(screen.getByDisplayValue('# v1 édité à la main')).toBeDefined()
  })
})
