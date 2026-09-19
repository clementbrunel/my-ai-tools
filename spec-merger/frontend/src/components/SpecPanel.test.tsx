import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SpecPanel from './SpecPanel'
import { generateSpecFromWord, previewWord, updateDocument } from '../api/analysis'
import { usePersistedDoc } from '../hooks/usePersistedDoc'

vi.mock('../api/analysis', () => ({
  generateSpecFromWord: vi.fn(),
  previewWord: vi.fn(),
  updateDocument: vi.fn(),
}))

const generateSpecFromWordMock = vi.mocked(generateSpecFromWord)
const previewWordMock = vi.mocked(previewWord)
const updateDocumentMock = vi.mocked(updateDocument)

beforeEach(() => {
  generateSpecFromWordMock.mockReset()
  previewWordMock.mockReset()
  updateDocumentMock.mockReset()
})

/** SpecPanel's doc is controlled by its parent — this harness stands in for App. */
function renderSpecPanel(onCollapse?: () => void, sessionId?: string | null) {
  function Harness() {
    const doc = usePersistedDoc()
    return <SpecPanel onCollapse={onCollapse} doc={doc} claimSessionId={sessionId ? () => sessionId : undefined} />
  }
  return render(<Harness />)
}

describe('SpecPanel', () => {
  it('renders the section label and starts on the Input tab with a file picker', () => {
    const { container } = renderSpecPanel()
    expect(screen.getByText('Spec Word / Excel')).toBeDefined()
    expect(container.querySelector('input[type="file"]')).not.toBeNull()
  })

  it('does not show a filename when no file is selected', () => {
    renderSpecPanel()
    expect(screen.queryByText(/\.docx/)).toBeNull()
  })

  it('labels the picker in French instead of the native "Choose File" button', () => {
    renderSpecPanel()
    expect(screen.getByText('Choisir un fichier')).toBeDefined()
    expect(screen.getByText(/Aucun fichier choisi/)).toBeDefined()
  })

  it('shows the filename once a file is picked, and keeps Générer la doc enabled', async () => {
    const { container } = renderSpecPanel()
    const file = new File(['contenu'], 'spec.docx')
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, file)
    expect(screen.getByText('spec.docx')).toBeDefined()
    expect(screen.getByText('Générer la doc')).not.toBeDisabled()
  })

  it('leaves Générer la doc enabled without a file — falls back to the mock sample server-side', () => {
    renderSpecPanel()
    expect(screen.getByText('Générer la doc')).not.toBeDisabled()
  })

  it('generates without a file, passing the current session id through', async () => {
    generateSpecFromWordMock.mockResolvedValue({ id: 'word-1', markdown: '# Doc générée', sessionId: 'session-1' })
    renderSpecPanel(undefined, 'session-1')
    await userEvent.click(screen.getByText('Générer la doc'))
    expect(generateSpecFromWordMock).toHaveBeenCalledWith(undefined, 'session-1')
  })

  it('generates the spec and switches to the Output tab', async () => {
    generateSpecFromWordMock.mockResolvedValue({ id: 'word-1', markdown: '# Doc générée', sessionId: 'session-1' })
    const { container } = renderSpecPanel()
    const file = new File(['contenu'], 'spec.docx')
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, file)
    await userEvent.click(screen.getByText('Générer la doc'))
    expect(generateSpecFromWordMock).toHaveBeenCalledWith(file, undefined)
    expect(await screen.findByRole('heading', { level: 1, name: 'Doc générée' })).toBeDefined()
  })

  it('names the Word file in the loader while generating', async () => {
    let resolveGeneration: (result: { id: string; markdown: string; sessionId: string }) => void = () => {}
    generateSpecFromWordMock.mockReturnValue(new Promise((resolve) => { resolveGeneration = resolve }))
    const { container } = renderSpecPanel()
    const file = new File(['contenu'], 'spec.docx')
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, file)
    await userEvent.click(screen.getByText('Générer la doc'))
    expect(await screen.findByText('Génération de la doc depuis le Word en cours…')).toBeDefined()
    resolveGeneration({ id: 'word-1', markdown: '# Doc générée', sessionId: 'session-1' })
  })

  it('names the Excel file in the loader while generating', async () => {
    let resolveGeneration: (result: { id: string; markdown: string; sessionId: string }) => void = () => {}
    generateSpecFromWordMock.mockReturnValue(new Promise((resolve) => { resolveGeneration = resolve }))
    const { container } = renderSpecPanel()
    const file = new File(['contenu'], 'spec.xlsx')
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, file)
    await userEvent.click(screen.getByText('Générer la doc'))
    expect(await screen.findByText("Génération de la doc depuis l'Excel en cours…")).toBeDefined()
    resolveGeneration({ id: 'word-1', markdown: '# Doc générée', sessionId: 'session-1' })
  })

  it('names the sample in the loader while generating without a file', async () => {
    let resolveGeneration: (result: { id: string; markdown: string; sessionId: string }) => void = () => {}
    generateSpecFromWordMock.mockReturnValue(new Promise((resolve) => { resolveGeneration = resolve }))
    renderSpecPanel()
    await userEvent.click(screen.getByText('Générer la doc'))
    expect(await screen.findByText("Génération de la doc depuis l'exemple en cours…")).toBeDefined()
    resolveGeneration({ id: 'word-1', markdown: '# Doc générée', sessionId: 'session-1' })
  })

  it('shows an error message when generation fails', async () => {
    generateSpecFromWordMock.mockRejectedValue(new Error('Échec du parsing'))
    const { container } = renderSpecPanel()
    const file = new File(['contenu'], 'spec.docx')
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, file)
    await userEvent.click(screen.getByText('Générer la doc'))
    expect(await screen.findByText('Échec du parsing')).toBeDefined()
  })

  it('calls onCollapse when the collapse button is clicked', async () => {
    const onCollapse = vi.fn()
    renderSpecPanel(onCollapse)
    await userEvent.click(screen.getByLabelText('Réduire le panneau Spec Word / Excel'))
    expect(onCollapse).toHaveBeenCalledTimes(1)
  })

  it('accepts a legacy .doc file, not just .docx', async () => {
    const { container } = renderSpecPanel()
    const file = new File(['contenu'], 'spec.doc')
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, file)
    expect(screen.getByText('spec.doc')).toBeDefined()
    expect(screen.getByText('Générer la doc')).not.toBeDisabled()
  })

  it('accepts an .xlsx file', async () => {
    const { container } = renderSpecPanel()
    const file = new File(['contenu'], 'spec.xlsx')
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, file)
    expect(screen.getByText('spec.xlsx')).toBeDefined()
    expect(screen.getByText('Générer la doc')).not.toBeDisabled()
  })

  it('rejects a file with an unsupported extension', async () => {
    const { container } = renderSpecPanel()
    // A malicious or misconfigured OS file picker can still bypass the input's `accept` filter,
    // so the component must re-validate the extension itself — applyAccept: false simulates that.
    const file = new File(['contenu'], 'spec.pdf')
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, file, { applyAccept: false })
    expect(screen.getByText(/seuls les fichiers \.doc, \.docx et \.xlsx sont acceptés/)).toBeDefined()
    expect(screen.queryByText('spec.pdf')).toBeNull()
  })

  it('previews the extracted text before generating', async () => {
    previewWordMock.mockResolvedValue('Ecran de connexion')
    const { container } = renderSpecPanel()
    const file = new File(['contenu'], 'spec.docx')
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, file)
    await userEvent.click(screen.getByText('Prévisualiser le texte extrait'))
    expect(previewWordMock).toHaveBeenCalledWith(file)
    expect(await screen.findByText('Ecran de connexion')).toBeDefined()
  })

  it('renders the preview as formatted markdown — headings and tables, not raw pipe characters', async () => {
    previewWordMock.mockResolvedValue('## Ecran de connexion\n\n| Champ | Valeur |\n| --- | --- |\n| Login | jdupont |')
    const { container } = renderSpecPanel()
    const file = new File(['contenu'], 'spec.docx')
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, file)
    await userEvent.click(screen.getByText('Prévisualiser le texte extrait'))
    expect(await screen.findByRole('heading', { level: 2, name: 'Ecran de connexion' })).toBeDefined()
    expect(screen.getByRole('cell', { name: 'jdupont' })).toBeDefined()
  })

  it('shows the raw markdown source via the Markdown brut tab', async () => {
    previewWordMock.mockResolvedValue('| Champ | Valeur |\n| --- | --- |\n| Login | jdupont |')
    const { container } = renderSpecPanel()
    const file = new File(['contenu'], 'spec.docx')
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, file)
    await userEvent.click(screen.getByText('Prévisualiser le texte extrait'))
    await screen.findByRole('cell', { name: 'jdupont' })
    await userEvent.click(screen.getByText('Markdown brut'))
    expect(screen.getByText(/\| Champ \| Valeur \|/)).toBeDefined()
  })

  it('shows no save button until the generated doc is edited', async () => {
    generateSpecFromWordMock.mockResolvedValue({ id: 'word-1', markdown: '# Doc générée', sessionId: 'session-1' })
    renderSpecPanel()
    await userEvent.click(screen.getByText('Générer la doc'))
    await screen.findByRole('heading', { level: 1, name: 'Doc générée' })

    expect(screen.queryByText('Enregistrer')).toBeNull()
  })

  it('shows a save button after editing, and saves on click without any debounce', async () => {
    generateSpecFromWordMock.mockResolvedValue({ id: 'word-1', markdown: '# Doc générée', sessionId: 'session-1' })
    updateDocumentMock.mockResolvedValue({ id: 'word-1', markdown: '# Doc éditée', sessionId: null })
    renderSpecPanel()
    await userEvent.click(screen.getByText('Générer la doc'))
    await screen.findByRole('heading', { level: 1, name: 'Doc générée' })

    await userEvent.click(screen.getByText('Édition Libre'))
    const textarea = screen.getByPlaceholderText('La doc générée depuis le Word apparaîtra ici après génération.')
    await userEvent.clear(textarea)
    await userEvent.type(textarea, '# Doc éditée')

    expect(updateDocumentMock).not.toHaveBeenCalled()
    await userEvent.click(await screen.findByText('Enregistrer'))

    expect(updateDocumentMock).toHaveBeenCalledWith('word-1', '# Doc éditée')
    expect(screen.queryByText('Enregistrer')).toBeNull()
  })

  it('shows an error message when saving fails', async () => {
    generateSpecFromWordMock.mockResolvedValue({ id: 'word-1', markdown: '# Doc générée', sessionId: 'session-1' })
    updateDocumentMock.mockRejectedValue(new Error("Échec de l'enregistrement"))
    renderSpecPanel()
    await userEvent.click(screen.getByText('Générer la doc'))
    await screen.findByRole('heading', { level: 1, name: 'Doc générée' })

    await userEvent.click(screen.getByText('Édition Libre'))
    const textarea = screen.getByPlaceholderText('La doc générée depuis le Word apparaîtra ici après génération.')
    await userEvent.clear(textarea)
    await userEvent.type(textarea, '# Doc éditée')
    await userEvent.click(await screen.findByText('Enregistrer'))

    expect(await screen.findByText("Échec de l'enregistrement")).toBeDefined()
    expect(screen.getByText('Enregistrer')).toBeDefined()
  })
})
