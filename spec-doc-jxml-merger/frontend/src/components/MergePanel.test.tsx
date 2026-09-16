import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MergePanel from './MergePanel'
import type { DocumentVersion } from '../types'

const versions: DocumentVersion[] = [
  { id: 'v2', versionNumber: 2, source: 'MANUAL_EDIT', createdAt: '2026-09-16T10:42:00Z' },
  { id: 'v1', versionNumber: 1, source: 'GENERATED', createdAt: '2026-09-15T17:05:00Z' },
]

describe('MergePanel', () => {
  it('renders the markdown value in the textarea', () => {
    render(<MergePanel markdown="# Titre" onMarkdownChange={vi.fn()} versions={[]} onRestore={vi.fn()} />)
    expect(screen.getByPlaceholderText(/apparaîtra ici/)).toHaveValue('# Titre')
  })

  it('calls onMarkdownChange when edited', async () => {
    const onMarkdownChange = vi.fn()
    render(<MergePanel markdown="" onMarkdownChange={onMarkdownChange} versions={[]} onRestore={vi.fn()} />)
    await userEvent.type(screen.getByPlaceholderText(/apparaîtra ici/), 'x')
    expect(onMarkdownChange).toHaveBeenCalledWith('x')
  })

  it('does not render the history section when there are no versions', () => {
    render(<MergePanel markdown="" onMarkdownChange={vi.fn()} versions={[]} onRestore={vi.fn()} />)
    expect(screen.queryByText('Historique')).toBeNull()
  })

  it('lists each version with its number and source', () => {
    render(<MergePanel markdown="" onMarkdownChange={vi.fn()} versions={versions} onRestore={vi.fn()} />)
    expect(screen.getByText(/v2 — MANUAL_EDIT/)).toBeDefined()
    expect(screen.getByText(/v1 — GENERATED/)).toBeDefined()
  })

  it('calls onRestore with the version id when Restaurer is clicked', async () => {
    const onRestore = vi.fn()
    render(<MergePanel markdown="" onMarkdownChange={vi.fn()} versions={versions} onRestore={onRestore} />)
    const buttons = screen.getAllByText('Restaurer')
    await userEvent.click(buttons[0])
    expect(onRestore).toHaveBeenCalledWith('v2')
  })
})
