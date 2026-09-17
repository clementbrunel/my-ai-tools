import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MarkdownView from './MarkdownView'

describe('MarkdownView', () => {
  it('renders the value in the textarea by default', () => {
    render(<MarkdownView value="# Titre" onChange={vi.fn()} placeholder="placeholder text" />)
    expect(screen.getByPlaceholderText('placeholder text')).toHaveValue('# Titre')
  })

  it('calls onChange when edited', async () => {
    const onChange = vi.fn()
    render(<MarkdownView value="" onChange={onChange} placeholder="placeholder text" />)
    await userEvent.type(screen.getByPlaceholderText('placeholder text'), 'x')
    expect(onChange).toHaveBeenCalledWith('x')
  })

  it('renders the markdown as formatted HTML when switching to Aperçu', async () => {
    render(<MarkdownView value={'# Titre\n\ntexte **gras**'} onChange={vi.fn()} placeholder="placeholder text" />)
    await userEvent.click(screen.getByText('Aperçu'))
    expect(screen.getByRole('heading', { level: 1, name: 'Titre' })).toBeDefined()
    expect(screen.getByText('gras').tagName).toBe('STRONG')
  })

  it('sanitizes raw HTML embedded in the markdown before rendering', async () => {
    render(
      <MarkdownView
        value={'texte <img src=x onerror="window.__pwned = true">'}
        onChange={vi.fn()}
        placeholder="placeholder text"
      />,
    )
    await userEvent.click(screen.getByText('Aperçu'))
    expect(document.querySelector('img[onerror]')).toBeNull()
  })

  it('shows the placeholder text instead of an empty preview box', async () => {
    render(<MarkdownView value="" onChange={vi.fn()} placeholder="Rien à afficher pour le moment." />)
    await userEvent.click(screen.getByText('Aperçu'))
    expect(screen.getByText('Rien à afficher pour le moment.')).toBeDefined()
  })
})
