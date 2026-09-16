import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CodePanel from './CodePanel'
import type { GitLabProjectSummary } from '../types'

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
