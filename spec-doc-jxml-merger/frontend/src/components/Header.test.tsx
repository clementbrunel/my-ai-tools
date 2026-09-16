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

  it('hides Save/Download buttons when there is no session', () => {
    render(<Header {...baseProps} hasSession={false} />)
    expect(screen.queryByText("Enregistrer l'édition")).toBeNull()
    expect(screen.queryByText('Télécharger le markdown')).toBeNull()
  })

  it('shows Save/Download buttons and wires them once a session exists', async () => {
    const onSave = vi.fn()
    const onDownload = vi.fn()
    render(<Header {...baseProps} hasSession={true} onSave={onSave} onDownload={onDownload} />)
    await userEvent.click(screen.getByText("Enregistrer l'édition"))
    await userEvent.click(screen.getByText('Télécharger le markdown'))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onDownload).toHaveBeenCalledTimes(1)
  })
})
