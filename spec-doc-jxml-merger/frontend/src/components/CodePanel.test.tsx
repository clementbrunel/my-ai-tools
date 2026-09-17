import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CodePanel from './CodePanel'
import { generateSpecFromGitlab, listGitlabProjects, listGitlabSources, previewGitlabJxml } from '../api/analysis'
import type { GitLabProjectSummary, GitLabSourceListing } from '../types'

vi.mock('../api/analysis', () => ({
  generateSpecFromGitlab: vi.fn(),
  listGitlabProjects: vi.fn(),
  listGitlabSources: vi.fn(),
  previewGitlabJxml: vi.fn(),
}))

const generateSpecFromGitlabMock = vi.mocked(generateSpecFromGitlab)
const listGitlabProjectsMock = vi.mocked(listGitlabProjects)
const listGitlabSourcesMock = vi.mocked(listGitlabSources)
const previewGitlabJxmlMock = vi.mocked(previewGitlabJxml)

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
})

async function goToGitlabModeWithProject() {
  listGitlabProjectsMock.mockResolvedValue(projects)
  listGitlabSourcesMock.mockResolvedValue(singleEntryPointListing)
  const result = render(<CodePanel />)
  await userEvent.click(screen.getByText('Charger les projets GitLab'))
  await screen.findByRole('combobox')
  await userEvent.selectOptions(screen.getByRole('combobox'), '1')
  await screen.findByText('demarche_un')
  return result
}

describe('CodePanel', () => {
  it('renders the GitLab project loader on the Input tab by default', () => {
    render(<CodePanel />)
    expect(screen.getByText('Charger les projets GitLab')).toBeDefined()
  })

  it('loads and lists GitLab projects when the load button is clicked', async () => {
    listGitlabProjectsMock.mockResolvedValue(projects)
    render(<CodePanel />)
    await userEvent.click(screen.getByText('Charger les projets GitLab'))
    expect(await screen.findByText('[jway-forms] jway-forms/claims')).toBeDefined()
  })

  it('filters the project dropdown using the search field', async () => {
    listGitlabProjectsMock.mockResolvedValue(projects)
    render(<CodePanel />)
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
    render(<CodePanel />)
    expect(screen.getByText('Générer la doc')).toBeDisabled()
  })

  it('generates the spec from the GitLab entry point once one is selected', async () => {
    await goToGitlabModeWithProject()
    generateSpecFromGitlabMock.mockResolvedValue('# Doc GitLab')
    await userEvent.click(screen.getByText('Générer la doc'))
    expect(generateSpecFromGitlabMock).toHaveBeenCalledWith({
      groupKey: 'jway-forms',
      projectId: '1',
      entryPointPath: 'forms/demarche_un.jxml',
      selectedPaths: ['forms/kyc.jxml', 'forms/claims.jxml'],
    })
    expect(await screen.findByPlaceholderText(/apparaîtra ici/)).toHaveValue('# Doc GitLab')
  })

  it('shows an error message when generation fails', async () => {
    generateSpecFromGitlabMock.mockRejectedValue(new Error('Échec GitLab'))
    await goToGitlabModeWithProject()
    await userEvent.click(screen.getByText('Générer la doc'))
    expect(await screen.findByText('Échec GitLab')).toBeDefined()
  })

  it('calls onCollapse when the collapse button is clicked', async () => {
    const onCollapse = vi.fn()
    render(<CodePanel onCollapse={onCollapse} />)
    await userEvent.click(screen.getByLabelText('Réduire le panneau Spec JXML'))
    expect(onCollapse).toHaveBeenCalledTimes(1)
  })
})
