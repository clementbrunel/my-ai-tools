import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Header from './Header'

beforeEach(() => {
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
})

describe('Header', () => {
  it('renders the app name', () => {
    render(<Header mergedDocumentId={null} onImportSession={vi.fn()} />)
    expect(screen.getByText('Spec Doc/JXML Merger')).toBeDefined()
  })

  it('shows no export button until a merge exists', () => {
    render(<Header mergedDocumentId={null} onImportSession={vi.fn()} />)
    expect(screen.queryByText("Exporter l'ID de session")).toBeNull()
  })

  it('copies the merged document id to the clipboard when exporting', async () => {
    render(<Header mergedDocumentId="merged-1" onImportSession={vi.fn()} />)
    await userEvent.click(screen.getByText("Exporter l'ID de session"))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('merged-1')
    expect(await screen.findByText('ID de session copié ✓')).toBeDefined()
  })

  it('loads a pasted session id', async () => {
    const onImportSession = vi.fn().mockResolvedValue(undefined)
    render(<Header mergedDocumentId={null} onImportSession={onImportSession} />)

    await userEvent.type(screen.getByPlaceholderText('Coller un ID de session…'), 'merged-2')
    await userEvent.click(screen.getByText('Charger une session'))

    expect(onImportSession).toHaveBeenCalledWith('merged-2')
  })

  it('shows an error message when loading a session fails', async () => {
    const onImportSession = vi.fn().mockRejectedValue(new Error('Document introuvable'))
    render(<Header mergedDocumentId={null} onImportSession={onImportSession} />)

    await userEvent.type(screen.getByPlaceholderText('Coller un ID de session…'), 'unknown')
    await userEvent.click(screen.getByText('Charger une session'))

    expect(await screen.findByText('Document introuvable')).toBeDefined()
  })
})
