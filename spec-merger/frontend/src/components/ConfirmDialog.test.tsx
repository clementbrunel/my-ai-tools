import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConfirmDialog from './ConfirmDialog'

describe('ConfirmDialog', () => {
  it('renders nothing when closed', () => {
    render(
      <ConfirmDialog open={false} message="Continuer ?" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    )
    expect(screen.queryByText('Continuer ?')).toBeNull()
  })

  it('shows the message and calls onConfirm when confirmed', async () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog open message="Continuer ?" confirmLabel="Oui" onConfirm={onConfirm} onCancel={vi.fn()} />,
    )
    expect(screen.getByText('Continuer ?')).toBeDefined()
    await userEvent.click(screen.getByText('Oui'))
    expect(onConfirm).toHaveBeenCalled()
  })

  it('calls onCancel when the backdrop is clicked', async () => {
    const onCancel = vi.fn()
    render(<ConfirmDialog open message="Continuer ?" onConfirm={vi.fn()} onCancel={onCancel} />)
    await userEvent.click(screen.getByRole('alertdialog').parentElement as HTMLElement)
    expect(onCancel).toHaveBeenCalled()
  })

  it('does not propagate a click inside the dialog to the backdrop', async () => {
    const onCancel = vi.fn()
    render(<ConfirmDialog open message="Continuer ?" onConfirm={vi.fn()} onCancel={onCancel} />)
    await userEvent.click(screen.getByRole('alertdialog'))
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('calls onCancel when the cancel button is clicked', async () => {
    const onCancel = vi.fn()
    render(<ConfirmDialog open message="Continuer ?" onConfirm={vi.fn()} onCancel={onCancel} />)
    await userEvent.click(screen.getByText('Annuler'))
    expect(onCancel).toHaveBeenCalled()
  })
})
