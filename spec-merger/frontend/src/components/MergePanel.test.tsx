import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MergePanel from './MergePanel'
import { mergeSpecs } from '../api/analysis'

vi.mock('../api/analysis', () => ({
  mergeSpecs: vi.fn(),
}))

const mergeSpecsMock = vi.mocked(mergeSpecs)

beforeEach(() => {
  mergeSpecsMock.mockReset()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

describe('MergePanel', () => {
  it('shows a waiting message and no button while either doc is missing', () => {
    render(<MergePanel wordMarkdown="" jxmlMarkdown="" />)
    expect(screen.getByText(/Génère la doc dans chacun des panneaux/)).toBeDefined()
    expect(screen.queryByText('Fusionner Word ⇄ JXML')).toBeNull()
  })

  it('still waits when only one of the two docs is ready', () => {
    render(<MergePanel wordMarkdown="# Word" jxmlMarkdown="" />)
    expect(screen.getByText(/Génère la doc dans chacun des panneaux/)).toBeDefined()
  })

  it('shows the big merge button once both docs are ready', () => {
    render(<MergePanel wordMarkdown="# Word" jxmlMarkdown="# JXML" />)
    expect(screen.getByText('Fusionner Word ⇄ JXML')).toBeDefined()
  })

  it('merges the two docs and shows the editable result', async () => {
    mergeSpecsMock.mockResolvedValue('# Document fusionné')
    render(<MergePanel wordMarkdown="# Word" jxmlMarkdown="# JXML" />)
    await userEvent.click(screen.getByText('Fusionner Word ⇄ JXML'))
    expect(mergeSpecsMock).toHaveBeenCalledWith('# Word', '# JXML')
    expect(await screen.findByRole('heading', { level: 1, name: 'Document fusionné' })).toBeDefined()
    expect(screen.getByText('Télécharger')).toBeDefined()
  })

  it('shows an error message when the merge fails', async () => {
    mergeSpecsMock.mockRejectedValue(new Error('Échec de la fusion IA'))
    render(<MergePanel wordMarkdown="# Word" jxmlMarkdown="# JXML" />)
    await userEvent.click(screen.getByText('Fusionner Word ⇄ JXML'))
    expect(await screen.findByText('Échec de la fusion IA')).toBeDefined()
  })

  it('re-merges without asking when the result has not been edited', async () => {
    mergeSpecsMock.mockResolvedValue('# v1')
    render(<MergePanel wordMarkdown="# Word" jxmlMarkdown="# JXML" />)
    await userEvent.click(screen.getByText('Fusionner Word ⇄ JXML'))
    await screen.findByText('Refusionner')

    mergeSpecsMock.mockResolvedValue('# v2')
    await userEvent.click(screen.getByText('Refusionner'))

    expect(window.confirm).not.toHaveBeenCalled()
    expect(await screen.findByRole('heading', { level: 1, name: 'v2' })).toBeDefined()
  })

  it('asks for confirmation before overwriting a manually edited result', async () => {
    mergeSpecsMock.mockResolvedValue('# v1')
    render(<MergePanel wordMarkdown="# Word" jxmlMarkdown="# JXML" />)
    await userEvent.click(screen.getByText('Fusionner Word ⇄ JXML'))
    await screen.findByText('Refusionner')

    await userEvent.click(screen.getByText('Édition'))
    const textarea = screen.getByPlaceholderText('') as HTMLTextAreaElement
    await userEvent.clear(textarea)
    await userEvent.type(textarea, '# v1 édité à la main')

    vi.mocked(window.confirm).mockReturnValue(false)
    mergeSpecsMock.mockResolvedValue('# v2')
    await userEvent.click(screen.getByText('Refusionner'))

    expect(window.confirm).toHaveBeenCalled()
    expect(mergeSpecsMock).toHaveBeenCalledTimes(1)
    expect(screen.getByDisplayValue('# v1 édité à la main')).toBeDefined()
  })
})
