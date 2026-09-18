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

  it('starts with an empty session-id field when there is no merge yet', () => {
    renderHeader()
    expect(screen.getByPlaceholderText('ID de session…')).toHaveValue('')
  })

  it('keeps the session-id field in sync with the merged document id', () => {
    const { rerender } = renderHeader({ mergedDocumentId: null })
    expect(screen.getByPlaceholderText('ID de session…')).toHaveValue('')

    rerender(
      <Header mergedDocumentId="merged-1" hasSession onImportSession={vi.fn()} onReset={vi.fn()} />,
    )
    expect(screen.getByPlaceholderText('ID de session…')).toHaveValue('merged-1')
  })

  it('copies the session id to the clipboard', async () => {
    renderHeader({ mergedDocumentId: 'merged-1' })
    await userEvent.click(screen.getByText('Copier'))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('merged-1')
    expect(await screen.findByText('Copié ✓')).toBeDefined()
  })

  it('disables Copier while the field is empty', () => {
    renderHeader()
    expect(screen.getByText('Copier')).toBeDisabled()
  })

  it('disables Charger while the field matches the current session (nothing new to load)', () => {
    renderHeader({ mergedDocumentId: 'merged-1' })
    expect(screen.getByPlaceholderText('ID de session…')).toHaveValue('merged-1')
    expect(screen.getByText('Charger')).toBeDisabled()
  })

  it('enables Charger once a different id is typed', async () => {
    renderHeader({ mergedDocumentId: 'merged-1' })
    const input = screen.getByPlaceholderText('ID de session…')
    await userEvent.clear(input)
    await userEvent.type(input, 'merged-2')
    expect(screen.getByText('Charger')).not.toBeDisabled()
  })

  it('loads a pasted session id', async () => {
    const onImportSession = vi.fn().mockResolvedValue(undefined)
    renderHeader({ onImportSession })

    await userEvent.type(screen.getByPlaceholderText('ID de session…'), 'merged-2')
    await userEvent.click(screen.getByText('Charger'))

    expect(onImportSession).toHaveBeenCalledWith('merged-2')
  })

  it('shows an error message when loading a session fails', async () => {
    const onImportSession = vi.fn().mockRejectedValue(new Error('Document introuvable'))
    renderHeader({ onImportSession })

    await userEvent.type(screen.getByPlaceholderText('ID de session…'), 'unknown')
    await userEvent.click(screen.getByText('Charger'))

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
