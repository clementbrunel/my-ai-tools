import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SpecPanel from './SpecPanel'
import { generateSpecFromWord, previewWord } from '../api/analysis'

vi.mock('../api/analysis', () => ({
  generateSpecFromWord: vi.fn(),
  previewWord: vi.fn(),
}))

const generateSpecFromWordMock = vi.mocked(generateSpecFromWord)
const previewWordMock = vi.mocked(previewWord)

beforeEach(() => {
  generateSpecFromWordMock.mockReset()
  previewWordMock.mockReset()
})

describe('SpecPanel', () => {
  it('renders the section label and starts on the Input tab with a file picker', () => {
    const { container } = render(<SpecPanel />)
    expect(screen.getByText('Spec Word / Excel')).toBeDefined()
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
    await userEvent.click(screen.getByLabelText('Réduire le panneau Spec Word / Excel'))
    expect(onCollapse).toHaveBeenCalledTimes(1)
  })

  it('accepts a legacy .doc file, not just .docx', async () => {
    const { container } = render(<SpecPanel />)
    const file = new File(['contenu'], 'spec.doc')
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, file)
    expect(screen.getByText('spec.doc')).toBeDefined()
    expect(screen.getByText('Générer la doc')).not.toBeDisabled()
  })

  it('accepts an .xlsx file', async () => {
    const { container } = render(<SpecPanel />)
    const file = new File(['contenu'], 'spec.xlsx')
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, file)
    expect(screen.getByText('spec.xlsx')).toBeDefined()
    expect(screen.getByText('Générer la doc')).not.toBeDisabled()
  })

  it('rejects a file with an unsupported extension', async () => {
    const { container } = render(<SpecPanel />)
    // A malicious or misconfigured OS file picker can still bypass the input's `accept` filter,
    // so the component must re-validate the extension itself — applyAccept: false simulates that.
    const file = new File(['contenu'], 'spec.pdf')
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, file, { applyAccept: false })
    expect(screen.getByText(/seuls les fichiers \.doc, \.docx et \.xlsx sont acceptés/)).toBeDefined()
    expect(screen.queryByText('spec.pdf')).toBeNull()
    expect(screen.getByText('Générer la doc')).toBeDisabled()
  })

  it('previews the extracted text before generating', async () => {
    previewWordMock.mockResolvedValue('Ecran de connexion')
    const { container } = render(<SpecPanel />)
    const file = new File(['contenu'], 'spec.docx')
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, file)
    await userEvent.click(screen.getByText('Prévisualiser le texte extrait'))
    expect(previewWordMock).toHaveBeenCalledWith(file)
    expect(await screen.findByText('Ecran de connexion')).toBeDefined()
  })
})
