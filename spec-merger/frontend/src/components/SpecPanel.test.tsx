import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SpecPanel from './SpecPanel'
import { generateSpecFromWord } from '../api/analysis'

vi.mock('../api/analysis', () => ({
  generateSpecFromWord: vi.fn(),
}))

const generateSpecFromWordMock = vi.mocked(generateSpecFromWord)

beforeEach(() => {
  generateSpecFromWordMock.mockReset()
})

describe('SpecPanel', () => {
  it('renders the section label and starts on the Input tab with a file picker', () => {
    const { container } = render(<SpecPanel />)
    expect(screen.getByText('Spec Word')).toBeDefined()
    expect(container.querySelector('input[type="file"]')).not.toBeNull()
  })

  it('does not show a filename when no file is selected', () => {
    render(<SpecPanel />)
    expect(screen.queryByText(/\.docx/)).toBeNull()
  })

  it('labels the picker in French instead of the native "Choose File" button', () => {
    render(<SpecPanel />)
    expect(screen.getByText('Choisir un fichier')).toBeDefined()
    expect(screen.getByText('Aucun fichier choisi')).toBeDefined()
  })

  it('shows the filename once a file is picked, and enables Générer la doc', async () => {
    const { container } = render(<SpecPanel />)
    const file = new File(['contenu'], 'spec.docx')
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, file)
    expect(screen.getByText('spec.docx')).toBeDefined()
    expect(screen.getByText('Générer la doc')).not.toBeDisabled()
  })

  it('disables Générer la doc until a file is selected', () => {
    render(<SpecPanel />)
    expect(screen.getByText('Générer la doc')).toBeDisabled()
  })

  it('generates the spec and switches to the Output tab', async () => {
    generateSpecFromWordMock.mockResolvedValue('# Doc générée')
    const { container } = render(<SpecPanel />)
    const file = new File(['contenu'], 'spec.docx')
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, file)
    await userEvent.click(screen.getByText('Générer la doc'))
    expect(generateSpecFromWordMock).toHaveBeenCalledWith(file)
    expect(await screen.findByRole('heading', { level: 1, name: 'Doc générée' })).toBeDefined()
  })

  it('shows an error message when generation fails', async () => {
    generateSpecFromWordMock.mockRejectedValue(new Error('Échec du parsing'))
    const { container } = render(<SpecPanel />)
    const file = new File(['contenu'], 'spec.docx')
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, file)
    await userEvent.click(screen.getByText('Générer la doc'))
    expect(await screen.findByText('Échec du parsing')).toBeDefined()
  })

  it('calls onCollapse when the collapse button is clicked', async () => {
    const onCollapse = vi.fn()
    render(<SpecPanel onCollapse={onCollapse} />)
    await userEvent.click(screen.getByLabelText('Réduire le panneau Spec Word'))
    expect(onCollapse).toHaveBeenCalledTimes(1)
  })
})
