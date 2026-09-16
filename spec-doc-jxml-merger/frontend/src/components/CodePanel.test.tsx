import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CodePanel from './CodePanel'
import type { GitLabEntryPoint, GitLabProjectSummary } from '../types'

const projects: GitLabProjectSummary[] = [
  { id: 1, name: 'onboarding-kyc', pathWithNamespace: 'jway-forms/onboarding-kyc', defaultBranch: 'main', webUrl: '', groupKey: 'jway-forms' },
  { id: 2, name: 'claims', pathWithNamespace: 'jway-forms/claims', defaultBranch: 'main', webUrl: '', groupKey: 'jway-forms' },
]

function baseProps(overrides: Partial<React.ComponentProps<typeof CodePanel>> = {}) {
  return {
    jxmlMode: 'zip' as const,
    onJxmlModeChange: vi.fn(),
    jxmlFile: null,
    onJxmlFileChange: vi.fn(),
    jxmlText: '',
    onJxmlTextChange: vi.fn(),
    gitlabProjects: [] as GitLabProjectSummary[],
    gitlabProjectId: '',
    onSelectGitlabProject: vi.fn(),
    gitlabLoading: false,
    onLoadGitlabProjects: vi.fn(),
    gitlabSearch: '',
    onGitlabSearchChange: vi.fn(),
    gitlabEntryPoints: [] as GitLabEntryPoint[],
    gitlabEntryPointPath: '',
    onSelectGitlabEntryPoint: vi.fn(),
    onPreviewGitlabJxml: vi.fn(),
    onPreviewGitlabSpec: vi.fn(),
    gitlabPreviewOpen: false,
    gitlabPreviewKind: 'jxml' as const,
    gitlabPreviewContent: '',
    gitlabPreviewWarnings: [] as string[],
    gitlabPreviewLoading: false,
    onCloseGitlabPreview: vi.fn(),
    gitlabSourcePaths: [] as string[],
    gitlabSelectedPaths: new Set<string>(),
    onToggleGitlabPath: vi.fn(),
    onSelectAllGitlabPaths: vi.fn(),
    onClearGitlabPaths: vi.fn(),
    gitlabSourcesLoading: false,
    ...overrides,
  }
}

describe('CodePanel', () => {
  it('shows the zip file input in zip mode', () => {
    const { container } = render(<CodePanel {...baseProps()} />)
    expect(container.querySelector('input[type="file"][accept=".zip"]')).not.toBeNull()
  })

  it('calls onJxmlModeChange when a tab is clicked', async () => {
    const onJxmlModeChange = vi.fn()
    render(<CodePanel {...baseProps({ onJxmlModeChange })} />)
    await userEvent.click(screen.getByText('Coller le texte'))
    expect(onJxmlModeChange).toHaveBeenCalledWith('text')
  })

  it('renders a textarea bound to jxmlText in text mode', () => {
    render(<CodePanel {...baseProps({ jxmlMode: 'text', jxmlText: '<jform/>' })} />)
    expect(screen.getByPlaceholderText('Colle ici le contenu JXML')).toHaveValue('<jform/>')
  })

  it('calls onLoadGitlabProjects when the load button is clicked in gitlab mode', async () => {
    const onLoadGitlabProjects = vi.fn()
    render(<CodePanel {...baseProps({ jxmlMode: 'gitlab', onLoadGitlabProjects })} />)
    await userEvent.click(screen.getByText('Charger les projets GitLab'))
    expect(onLoadGitlabProjects).toHaveBeenCalledTimes(1)
  })

  it('filters the project dropdown using the search field', () => {
    render(<CodePanel {...baseProps({ jxmlMode: 'gitlab', gitlabProjects: projects, gitlabSearch: 'claims' })} />)
    expect(screen.getByText('[jway-forms] jway-forms/claims')).toBeDefined()
    expect(screen.queryByText('[jway-forms] jway-forms/onboarding-kyc')).toBeNull()
  })

  it('calls onSelectGitlabProject when a project is chosen', async () => {
    const onSelectGitlabProject = vi.fn()
    render(
      <CodePanel {...baseProps({ jxmlMode: 'gitlab', gitlabProjects: projects, onSelectGitlabProject })} />,
    )
    await userEvent.selectOptions(screen.getByRole('combobox'), '1')
    expect(onSelectGitlabProject).toHaveBeenCalledWith('1')
  })

  it('renders the source path checklist with the selection count', () => {
    render(
      <CodePanel
        {...baseProps({
          jxmlMode: 'gitlab',
          gitlabProjects: projects,
          gitlabSourcePaths: ['forms/kyc.jxml', 'forms/claims.jxml'],
          gitlabSelectedPaths: new Set(['forms/kyc.jxml']),
        })}
      />,
    )
    expect(screen.getByText('1 / 2 fichier(s) inclus')).toBeDefined()
    expect(screen.getByText('forms/kyc.jxml')).toBeDefined()
    expect(screen.getByText('forms/claims.jxml')).toBeDefined()
  })

  it('calls onToggleGitlabPath when a checkbox is clicked', async () => {
    const onToggleGitlabPath = vi.fn()
    render(
      <CodePanel
        {...baseProps({
          jxmlMode: 'gitlab',
          gitlabSourcePaths: ['forms/kyc.jxml'],
          gitlabSelectedPaths: new Set(['forms/kyc.jxml']),
          onToggleGitlabPath,
        })}
      />,
    )
    await userEvent.click(screen.getByRole('checkbox'))
    expect(onToggleGitlabPath).toHaveBeenCalledWith('forms/kyc.jxml')
  })

  it('renders the entry point candidates as a single-select radio group', () => {
    const entryPoints: GitLabEntryPoint[] = [
      { documentId: 'demarche_un', path: 'forms/demarche_un.jxml' },
      { documentId: 'DEMARCHE_DEUX', path: 'forms/DEMARCHE_DEUX.jxml' },
    ]
    render(
      <CodePanel
        {...baseProps({ jxmlMode: 'gitlab', gitlabEntryPoints: entryPoints, gitlabEntryPointPath: 'forms/demarche_un.jxml' })}
      />,
    )
    const radios = screen.getAllByRole('radio', { name: /demarche/i })
    expect(radios).toHaveLength(2)
    expect(radios[0]).toBeChecked()
    expect(radios[1]).not.toBeChecked()
  })

  it('calls onSelectGitlabEntryPoint when another entry point is picked', async () => {
    const onSelectGitlabEntryPoint = vi.fn()
    const entryPoints: GitLabEntryPoint[] = [
      { documentId: 'demarche_un', path: 'forms/demarche_un.jxml' },
      { documentId: 'DEMARCHE_DEUX', path: 'forms/DEMARCHE_DEUX.jxml' },
    ]
    render(
      <CodePanel
        {...baseProps({
          jxmlMode: 'gitlab',
          gitlabEntryPoints: entryPoints,
          gitlabEntryPointPath: 'forms/demarche_un.jxml',
          onSelectGitlabEntryPoint,
        })}
      />,
    )
    await userEvent.click(screen.getByText('DEMARCHE_DEUX'))
    expect(onSelectGitlabEntryPoint).toHaveBeenCalledWith('forms/DEMARCHE_DEUX.jxml')
  })

  it('does not render the entry point section when there are no candidates', () => {
    render(<CodePanel {...baseProps({ jxmlMode: 'gitlab', gitlabEntryPoints: [] })} />)
    expect(screen.queryByText(/Démarche à documenter/)).toBeNull()
  })

  it('does not show the preview button before an entry point is chosen', () => {
    render(<CodePanel {...baseProps({ jxmlMode: 'gitlab', gitlabEntryPointPath: '' })} />)
    expect(screen.queryByText('Prévisualiser le JXML résolu')).toBeNull()
  })

  it('calls onPreviewGitlabJxml when the preview button is clicked', async () => {
    const onPreviewGitlabJxml = vi.fn()
    render(
      <CodePanel
        {...baseProps({ jxmlMode: 'gitlab', gitlabEntryPointPath: 'forms/demarche_un.jxml', onPreviewGitlabJxml })}
      />,
    )
    await userEvent.click(screen.getByText('Prévisualiser le JXML résolu'))
    expect(onPreviewGitlabJxml).toHaveBeenCalledTimes(1)
  })

  it('shows the resolved JXML content as a collapsible tree when the preview panel is open', () => {
    const { container } = render(
      <CodePanel
        {...baseProps({
          jxmlMode: 'gitlab',
          gitlabEntryPointPath: 'forms/demarche_un.jxml',
          gitlabPreviewOpen: true,
          gitlabPreviewContent: '<JForm><Section/></JForm>',
        })}
      />,
    )
    expect(container.textContent).toContain('JForm')
    expect(container.textContent).toContain('Section')
  })

  it('calls onPreviewGitlabSpec when the spec preview button is clicked', async () => {
    const onPreviewGitlabSpec = vi.fn()
    render(
      <CodePanel
        {...baseProps({ jxmlMode: 'gitlab', gitlabEntryPointPath: 'forms/demarche_un.jxml', onPreviewGitlabSpec })}
      />,
    )
    await userEvent.click(screen.getByText('Générer la doc depuis le JXML (aperçu IA)'))
    expect(onPreviewGitlabSpec).toHaveBeenCalledTimes(1)
  })

  it('shows the raw text when the raw view mode is selected', async () => {
    render(
      <CodePanel
        {...baseProps({
          jxmlMode: 'gitlab',
          gitlabEntryPointPath: 'forms/demarche_un.jxml',
          gitlabPreviewOpen: true,
          gitlabPreviewKind: 'jxml',
          gitlabPreviewContent: '<JForm><Section/></JForm>',
        })}
      />,
    )
    await userEvent.click(screen.getByText('Texte brut'))
    expect(screen.getByText('<JForm><Section/></JForm>')).toBeDefined()
    expect(screen.getByText(/JXML envoyé au modèle/)).toBeDefined()
  })

  it('shows the generated spec content when the spec preview panel is open', () => {
    render(
      <CodePanel
        {...baseProps({
          jxmlMode: 'gitlab',
          gitlabEntryPointPath: 'forms/demarche_un.jxml',
          gitlabPreviewOpen: true,
          gitlabPreviewKind: 'spec',
          gitlabPreviewContent: '## Écran 1 — Description du champ.',
        })}
      />,
    )
    expect(screen.getByText('## Écran 1 — Description du champ.')).toBeDefined()
    expect(screen.getByText(/Documentation générée par l'IA/)).toBeDefined()
  })

  it('shows preview warnings prominently when present', () => {
    render(
      <CodePanel
        {...baseProps({
          jxmlMode: 'gitlab',
          gitlabEntryPointPath: 'forms/demarche_un.jxml',
          gitlabPreviewOpen: true,
          gitlabPreviewContent: '<JForm><Section></JForm>',
          gitlabPreviewWarnings: ['Balise <Section> jamais refermée.'],
        })}
      />,
    )
    expect(screen.getByText('Balise <Section> jamais refermée.')).toBeDefined()
  })

  it('calls onCloseGitlabPreview when the preview panel is closed', async () => {
    const onCloseGitlabPreview = vi.fn()
    render(
      <CodePanel
        {...baseProps({
          jxmlMode: 'gitlab',
          gitlabEntryPointPath: 'forms/demarche_un.jxml',
          gitlabPreviewOpen: true,
          gitlabPreviewContent: '<JForm/>',
          onCloseGitlabPreview,
        })}
      />,
    )
    await userEvent.click(screen.getByText('Fermer'))
    expect(onCloseGitlabPreview).toHaveBeenCalledTimes(1)
  })

  it('calls onSelectAllGitlabPaths / onClearGitlabPaths from the bulk actions', async () => {
    const onSelectAllGitlabPaths = vi.fn()
    const onClearGitlabPaths = vi.fn()
    render(
      <CodePanel
        {...baseProps({
          jxmlMode: 'gitlab',
          gitlabSourcePaths: ['forms/kyc.jxml'],
          onSelectAllGitlabPaths,
          onClearGitlabPaths,
        })}
      />,
    )
    await userEvent.click(screen.getByText('Tout cocher'))
    await userEvent.click(screen.getByText('Tout décocher'))
    expect(onSelectAllGitlabPaths).toHaveBeenCalledTimes(1)
    expect(onClearGitlabPaths).toHaveBeenCalledTimes(1)
  })
})
