import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Header from './Header'

const baseProps = {
  title: '',
  onTitleChange: vi.fn(),
  onAnalyze: vi.fn(),
  loading: false,
  hasSession: false,
  hasMarkdown: false,
  onSave: vi.fn(),
  onDownload: vi.fn(),
}

describe('Header', () => {
  it('calls onTitleChange when typing in the title field', async () => {
    const onTitleChange = vi.fn()
    render(<Header {...baseProps} onTitleChange={onTitleChange} />)
    await userEvent.type(screen.getByPlaceholderText('Titre de la spécification'), 'x')
    expect(onTitleChange).toHaveBeenCalledWith('x')
  })

  it('calls onAnalyze when the Analyser button is clicked', async () => {
    const onAnalyze = vi.fn()
    render(<Header {...baseProps} onAnalyze={onAnalyze} />)
    await userEvent.click(screen.getByText('Analyser'))
    expect(onAnalyze).toHaveBeenCalledTimes(1)
  })

  it('disables the Analyser button and shows a progress label while loading', () => {
    render(<Header {...baseProps} loading={true} />)
    expect(screen.getByText('Analyse en cours…')).toBeDisabled()
  })

  it('hides the Save button when there is no session', () => {
    render(<Header {...baseProps} hasSession={false} />)
    expect(screen.queryByText("Enregistrer l'édition")).toBeNull()
  })

  it('shows and wires the Save button once a session exists', async () => {
    const onSave = vi.fn()
    render(<Header {...baseProps} hasSession={true} onSave={onSave} />)
    await userEvent.click(screen.getByText("Enregistrer l'édition"))
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('hides the Download button when there is no markdown yet', () => {
    render(<Header {...baseProps} hasMarkdown={false} />)
    expect(screen.queryByText('Télécharger le markdown')).toBeNull()
  })

  it('shows and wires the Download button once markdown exists, even without a session', async () => {
    const onDownload = vi.fn()
    render(<Header {...baseProps} hasSession={false} hasMarkdown={true} onDownload={onDownload} />)
    await userEvent.click(screen.getByText('Télécharger le markdown'))
    expect(onDownload).toHaveBeenCalledTimes(1)
  })
})
