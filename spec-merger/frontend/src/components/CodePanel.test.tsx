import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CodePanel from './CodePanel'
import {
  generateSpecFromGitlab,
  listGitlabProjects,
  listGitlabSources,
  previewGitlabJxml,
  updateDocument,
} from '../api/analysis'
import { usePersistedDoc } from '../hooks/usePersistedDoc'
import type { GitLabProjectSummary, GitLabSourceListing, GitlabSelection } from '../types'

vi.mock('../api/analysis', () => ({
  generateSpecFromGitlab: vi.fn(),
  listGitlabProjects: vi.fn(),
  listGitlabSources: vi.fn(),
  previewGitlabJxml: vi.fn(),
  updateDocument: vi.fn(),
}))

const generateSpecFromGitlabMock = vi.mocked(generateSpecFromGitlab)
const listGitlabProjectsMock = vi.mocked(listGitlabProjects)
const listGitlabSourcesMock = vi.mocked(listGitlabSources)
const previewGitlabJxmlMock = vi.mocked(previewGitlabJxml)
const updateDocumentMock = vi.mocked(updateDocument)

const projects: GitLabProjectSummary[] = [
  { id: 1, name: 'onboarding-kyc', pathWithNamespace: 'jway-forms/onboarding-kyc', defaultBranch: 'main', webUrl: '', groupKey: 'jway-forms' },
  { id: 2, name: 'claims', pathWithNamespace: 'jway-forms/claims', defaultBranch: 'main', webUrl: '', groupKey: 'jway-forms' },
]

const singleEntryPointListing: GitLabSourceListing = {
  entryPoints: [{ documentId: 'demarche_un', path: 'forms/demarche_un.jxml' }],
  mandatoryPaths: ['resources/fr.properties'],
  optionalPaths: ['forms/kyc.jxml', 'forms/claims.jxml'],
}

beforeEach(() => {
  generateSpecFromGitlabMock.mockReset()
  listGitlabProjectsMock.mockReset()
  listGitlabSourcesMock.mockReset()
  previewGitlabJxmlMock.mockReset()
  updateDocumentMock.mockReset()
})

/** CodePanel's doc is controlled by its parent — this harness stands in for App. */
function renderCodePanel(
  onCollapse?: () => void,
  options?: {
    sessionId?: string | null
    initialGitlabSelection?: GitlabSelection | null
    onGitlabSelectionChange?: (selection: GitlabSelection | null) => void
  },
) {
  function Harness() {
    const doc = usePersistedDoc()
    return (
      <CodePanel
        onCollapse={onCollapse}
        doc={doc}
        claimSessionId={options?.sessionId ? () => options.sessionId as string : undefined}
        initialGitlabSelection={options?.initialGitlabSelection}
        onGitlabSelectionChange={options?.onGitlabSelectionChange}
      />
    )
  }
  return render(<Harness />)
}

async function goToGitlabModeWithProject() {
  listGitlabProjectsMock.mockResolvedValue(projects)
  listGitlabSourcesMock.mockResolvedValue(singleEntryPointListing)
  const result = renderCodePanel()
  await userEvent.click(screen.getByText('Charger les projets GitLab'))
  await screen.findByRole('combobox')
  await userEvent.selectOptions(screen.getByRole('combobox'), '1')
  await screen.findByText('demarche_un')
  return result
}

describe('CodePanel', () => {
  it('renders the GitLab project loader on the Input tab by default', () => {
    renderCodePanel()
    expect(screen.getByText('Charger les projets GitLab')).toBeDefined()
  })

  it('loads and lists GitLab projects when the load button is clicked', async () => {
    listGitlabProjectsMock.mockResolvedValue(projects)
    renderCodePanel()
    await userEvent.click(screen.getByText('Charger les projets GitLab'))
    expect(await screen.findByText('[jway-forms] jway-forms/claims')).toBeDefined()
  })

  it('filters the project dropdown using the search field', async () => {
    listGitlabProjectsMock.mockResolvedValue(projects)
    renderCodePanel()
    await userEvent.click(screen.getByText('Charger les projets GitLab'))
    await screen.findByText('[jway-forms] jway-forms/claims')
    await userEvent.type(screen.getByPlaceholderText(/Rechercher un projet/), 'claims')
    expect(screen.getByText('[jway-forms] jway-forms/claims')).toBeDefined()
    expect(screen.queryByText('[jway-forms] jway-forms/onboarding-kyc')).toBeNull()
  })

  it('loads sources (all pre-selected) and auto-selects the single entry point candidate', async () => {
    await goToGitlabModeWithProject()
    expect(screen.getByText('2 / 2 fichier(s) inclus')).toBeDefined()
    expect(screen.getByText('forms/kyc.jxml')).toBeDefined()
    const radio = screen.getByRole('radio', { name: /demarche_un/i })
    expect(radio).toBeChecked()
  })

  it('shows the preview button only once an entry point is chosen, and opens the resolved JXML', async () => {
    const { container } = await goToGitlabModeWithProject()
    previewGitlabJxmlMock.mockResolvedValue({ content: '<JForm><Section/></JForm>', warnings: [] })
    await userEvent.click(screen.getByText('Prévisualiser le JXML résolu'))
    await screen.findByText(/JXML envoyé au modèle/)
    expect(container.textContent).toContain('JForm')
    expect(container.textContent).toContain('Section')
  })

  it('lists translation files as always-included and non-uncheckable', async () => {
    await goToGitlabModeWithProject()
    const item = screen.getByText('resources/fr.properties').closest('li') as HTMLElement
    const checkbox = within(item).getByRole('checkbox')
    expect(checkbox).toBeChecked()
    expect(checkbox).toBeDisabled()
  })

  it('toggles a source path via its checkbox', async () => {
    await goToGitlabModeWithProject()
    const checkbox = within(screen.getByText('forms/kyc.jxml').closest('li') as HTMLElement).getByRole('checkbox')
    expect(checkbox).toBeChecked()
    await userEvent.click(checkbox)
    expect(checkbox).not.toBeChecked()
  })

  it('bulk toggles all source paths', async () => {
    await goToGitlabModeWithProject()
    await userEvent.click(screen.getByText('Tout décocher'))
    expect(screen.getByText('0 / 2 fichier(s) inclus')).toBeDefined()
    await userEvent.click(screen.getByText('Tout cocher'))
    expect(screen.getByText('2 / 2 fichier(s) inclus')).toBeDefined()
  })

  it('disables Générer la doc until an entry point is selected', async () => {
    renderCodePanel()
    expect(screen.getByText('Générer la doc')).toBeDisabled()
  })

  it('generates the spec from the GitLab entry point once one is selected, passing the current session id and selection through', async () => {
    listGitlabProjectsMock.mockResolvedValue(projects)
    listGitlabSourcesMock.mockResolvedValue(singleEntryPointListing)
    renderCodePanel(undefined, { sessionId: 'session-1' })
    await userEvent.click(screen.getByText('Charger les projets GitLab'))
    await screen.findByRole('combobox')
    await userEvent.selectOptions(screen.getByRole('combobox'), '1')
    await screen.findByText('demarche_un')
    generateSpecFromGitlabMock.mockResolvedValue({ id: 'jxml-1', markdown: '# Doc GitLab', sessionId: 'session-1' })
    await userEvent.click(screen.getByText('Générer la doc'))
    const expectedSelection = {
      groupKey: 'jway-forms',
      projectId: '1',
      entryPointPath: 'forms/demarche_un.jxml',
      selectedPaths: ['forms/kyc.jxml', 'forms/claims.jxml'],
    }
    expect(generateSpecFromGitlabMock).toHaveBeenCalledWith(
      expectedSelection,
      'session-1',
      JSON.stringify(expectedSelection),
    )
    expect(await screen.findByRole('heading', { level: 1, name: 'Doc GitLab' })).toBeDefined()
  })

  it('shows an error message when generation fails', async () => {
    generateSpecFromGitlabMock.mockRejectedValue(new Error('Échec GitLab'))
    await goToGitlabModeWithProject()
    await userEvent.click(screen.getByText('Générer la doc'))
    expect(await screen.findByText('Échec GitLab')).toBeDefined()
  })

  it('calls onCollapse when the collapse button is clicked', async () => {
    const onCollapse = vi.fn()
    renderCodePanel(onCollapse)
    await userEvent.click(screen.getByLabelText('Réduire le panneau Spec JXML'))
    expect(onCollapse).toHaveBeenCalledTimes(1)
  })

  it('shows no save button until the generated doc is edited', async () => {
    await goToGitlabModeWithProject()
    generateSpecFromGitlabMock.mockResolvedValue({ id: 'jxml-1', markdown: '# Doc GitLab', sessionId: 'session-1' })
    await userEvent.click(screen.getByText('Générer la doc'))
    await screen.findByRole('heading', { level: 1, name: 'Doc GitLab' })

    expect(screen.queryByText('Enregistrer')).toBeNull()
  })

  it('shows a save button after editing, and saves on click without any debounce', async () => {
    await goToGitlabModeWithProject()
    generateSpecFromGitlabMock.mockResolvedValue({ id: 'jxml-1', markdown: '# Doc GitLab', sessionId: 'session-1' })
    updateDocumentMock.mockResolvedValue({ id: 'jxml-1', markdown: '# Doc éditée', sessionId: null })
    await userEvent.click(screen.getByText('Générer la doc'))
    await screen.findByRole('heading', { level: 1, name: 'Doc GitLab' })

    await userEvent.click(screen.getByText('Édition Libre'))
    const textarea = screen.getByPlaceholderText('La doc générée depuis le JXML apparaîtra ici après génération.')
    await userEvent.clear(textarea)
    await userEvent.type(textarea, '# Doc éditée')

    expect(updateDocumentMock).not.toHaveBeenCalled()
    await userEvent.click(await screen.findByText('Enregistrer'))

    expect(updateDocumentMock).toHaveBeenCalledWith('jxml-1', '# Doc éditée')
    expect(screen.queryByText('Enregistrer')).toBeNull()
  })

  it('shows an error message when saving fails', async () => {
    await goToGitlabModeWithProject()
    generateSpecFromGitlabMock.mockResolvedValue({ id: 'jxml-1', markdown: '# Doc GitLab', sessionId: 'session-1' })
    updateDocumentMock.mockRejectedValue(new Error("Échec de l'enregistrement"))
    await userEvent.click(screen.getByText('Générer la doc'))
    await screen.findByRole('heading', { level: 1, name: 'Doc GitLab' })

    await userEvent.click(screen.getByText('Édition Libre'))
    const textarea = screen.getByPlaceholderText('La doc générée depuis le JXML apparaîtra ici après génération.')
    await userEvent.clear(textarea)
    await userEvent.type(textarea, '# Doc éditée')
    await userEvent.click(await screen.findByText('Enregistrer'))

    expect(await screen.findByText("Échec de l'enregistrement")).toBeDefined()
    expect(screen.getByText('Enregistrer')).toBeDefined()
  })

  describe('GitLab selection restoration (#326)', () => {
    const restoredSelection: GitlabSelection = {
      groupKey: 'jway-forms',
      projectId: '1',
      entryPointPath: 'forms/kyc.jxml',
      selectedPaths: ['forms/kyc.jxml'],
    }

    it('replays the GitLab loading flow from a restored selection on mount', async () => {
      listGitlabProjectsMock.mockResolvedValue(projects)
      listGitlabSourcesMock.mockResolvedValue({
        entryPoints: [
          { documentId: 'kyc', path: 'forms/kyc.jxml' },
          { documentId: 'claims', path: 'forms/claims.jxml' },
        ],
        mandatoryPaths: ['resources/fr.properties'],
        optionalPaths: ['forms/kyc.jxml', 'forms/claims.jxml'],
      })

      renderCodePanel(undefined, { initialGitlabSelection: restoredSelection })

      expect(await screen.findByText('[jway-forms] jway-forms/onboarding-kyc')).toBeDefined()
      expect(listGitlabSourcesMock).toHaveBeenCalledWith('jway-forms', '1')

      const radio = await screen.findByRole('radio', { name: /kyc/i })
      expect(radio).toBeChecked()
      expect(screen.getByText('1 / 2 fichier(s) inclus')).toBeDefined()
      expect(screen.getByText('Générer la doc')).not.toBeDisabled()
    })

    it('drops a restored entry point or file that no longer exists in the project', async () => {
      listGitlabProjectsMock.mockResolvedValue(projects)
      listGitlabSourcesMock.mockResolvedValue({
        entryPoints: [{ documentId: 'claims', path: 'forms/claims.jxml' }],
        mandatoryPaths: [],
        optionalPaths: ['forms/claims.jxml'],
      })

      renderCodePanel(undefined, { initialGitlabSelection: restoredSelection })

      await screen.findByText('[jway-forms] jway-forms/onboarding-kyc')
      // The restored entry point (forms/kyc.jxml) is gone, and there's exactly one candidate left,
      // so it's auto-selected the same way handleSelectGitlabProject would for a fresh load.
      const radio = await screen.findByRole('radio', { name: /claims/i })
      expect(radio).toBeChecked()
      expect(screen.getByText('0 / 1 fichier(s) inclus')).toBeDefined()
    })

    it('reports the current selection upward as the user changes it', async () => {
      const onGitlabSelectionChange = vi.fn()
      listGitlabProjectsMock.mockResolvedValue(projects)
      listGitlabSourcesMock.mockResolvedValue(singleEntryPointListing)

      renderCodePanel(undefined, { onGitlabSelectionChange })
      await userEvent.click(screen.getByText('Charger les projets GitLab'))
      await userEvent.selectOptions(await screen.findByRole('combobox'), '1')
      await screen.findByText('demarche_un')

      expect(onGitlabSelectionChange).toHaveBeenLastCalledWith({
        groupKey: 'jway-forms',
        projectId: '1',
        entryPointPath: 'forms/demarche_un.jxml',
        selectedPaths: ['forms/kyc.jxml', 'forms/claims.jxml'],
      })
    })

    it('reports null once the project selection is cleared', async () => {
      const onGitlabSelectionChange = vi.fn()
      listGitlabProjectsMock.mockResolvedValue(projects)
      listGitlabSourcesMock.mockResolvedValue(singleEntryPointListing)

      renderCodePanel(undefined, { onGitlabSelectionChange })
      await userEvent.click(screen.getByText('Charger les projets GitLab'))
      const combobox = await screen.findByRole('combobox')
      await userEvent.selectOptions(combobox, '1')
      await screen.findByText('demarche_un')

      await userEvent.selectOptions(combobox, '')

      expect(onGitlabSelectionChange).toHaveBeenLastCalledWith(null)
    })
  })
})
