import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Header from './Header'

beforeEach(() => {
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
})

interface RenderOptions {
  mergedDocumentId?: string | null
  hasSession?: boolean
  onImportSession?: (mergedDocumentId: string) => Promise<void>
  onReset?: () => void
}

function renderHeader(options: RenderOptions = {}) {
  return render(
    <Header
      mergedDocumentId={options.mergedDocumentId ?? null}
      hasSession={options.hasSession ?? false}
      onImportSession={options.onImportSession ?? vi.fn()}
      onReset={options.onReset ?? vi.fn()}
    />,
  )
}

describe('Header', () => {
  it('renders the app name', () => {
    renderHeader()
    expect(screen.getByText('Spec Doc/JXML Merger')).toBeDefined()
  })

  it('shows no export button until a merge exists', () => {
    renderHeader()
    expect(screen.queryByText("Exporter l'ID de session")).toBeNull()
  })

  it('copies the merged document id to the clipboard when exporting', async () => {
    renderHeader({ mergedDocumentId: 'merged-1' })
    await userEvent.click(screen.getByText("Exporter l'ID de session"))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('merged-1')
    expect(await screen.findByText('ID de session copié ✓')).toBeDefined()
  })

  it('loads a pasted session id', async () => {
    const onImportSession = vi.fn().mockResolvedValue(undefined)
    renderHeader({ onImportSession })

    await userEvent.type(screen.getByPlaceholderText('Coller un ID de session…'), 'merged-2')
    await userEvent.click(screen.getByText('Charger une session'))

    expect(onImportSession).toHaveBeenCalledWith('merged-2')
  })

  it('shows an error message when loading a session fails', async () => {
    const onImportSession = vi.fn().mockRejectedValue(new Error('Document introuvable'))
    renderHeader({ onImportSession })

    await userEvent.type(screen.getByPlaceholderText('Coller un ID de session…'), 'unknown')
    await userEvent.click(screen.getByText('Charger une session'))

    expect(await screen.findByText('Document introuvable')).toBeDefined()
  })

  it('shows no reset button while the session is empty', () => {
    renderHeader({ hasSession: false })
    expect(screen.queryByText('Nouvelle session')).toBeNull()
  })

  it('resets after confirmation once a session exists', async () => {
    const onReset = vi.fn()
    renderHeader({ hasSession: true, onReset })

    await userEvent.click(screen.getByText('Nouvelle session'))
    expect(onReset).not.toHaveBeenCalled()
    await userEvent.click(screen.getByText('Repartir de zéro'))

    expect(onReset).toHaveBeenCalled()
  })

  it('does not reset when the confirmation is declined', async () => {
    const onReset = vi.fn()
    renderHeader({ hasSession: true, onReset })

    await userEvent.click(screen.getByText('Nouvelle session'))
    await userEvent.click(screen.getByText('Annuler'))

    expect(onReset).not.toHaveBeenCalled()
  })
})
