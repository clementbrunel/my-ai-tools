import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Header from './Header'

describe('Header', () => {
  it('renders the app name and the title field', () => {
    render(<Header title="" onTitleChange={vi.fn()} />)
    expect(screen.getByText('Spec Doc/JXML Merger')).toBeDefined()
    expect(screen.getByPlaceholderText('Titre de la spécification')).toHaveValue('')
  })

  it('calls onTitleChange when typing in the title field', async () => {
    const onTitleChange = vi.fn()
    render(<Header title="" onTitleChange={onTitleChange} />)
    await userEvent.type(screen.getByPlaceholderText('Titre de la spécification'), 'x')
    expect(onTitleChange).toHaveBeenCalledWith('x')
  })
})
