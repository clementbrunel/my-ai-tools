import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MarkdownView from './MarkdownView'

describe('MarkdownView', () => {
  it('renders the markdown as formatted HTML by default', () => {
    render(<MarkdownView value={'# Titre\n\ntexte **gras**'} onChange={vi.fn()} placeholder="placeholder text" />)
    expect(screen.getByRole('heading', { level: 1, name: 'Titre' })).toBeDefined()
    expect(screen.getByText('gras').tagName).toBe('STRONG')
  })

  it('shows the textarea after switching to Édition Libre', async () => {
    render(<MarkdownView value="# Titre" onChange={vi.fn()} placeholder="placeholder text" />)
    await userEvent.click(screen.getByText('Édition Libre'))
    expect(screen.getByPlaceholderText('placeholder text')).toHaveValue('# Titre')
  })

  it('calls onChange when edited in Édition Libre', async () => {
    const onChange = vi.fn()
    render(<MarkdownView value="" onChange={onChange} placeholder="placeholder text" />)
    await userEvent.click(screen.getByText('Édition Libre'))
    await userEvent.type(screen.getByPlaceholderText('placeholder text'), 'x')
    expect(onChange).toHaveBeenCalledWith('x')
  })

  it('shows the rich-text editor after switching to Édition Markdown', async () => {
    render(<MarkdownView value="# Titre" onChange={vi.fn()} placeholder="placeholder text" />)
    await userEvent.click(screen.getByText('Édition Markdown'))
    expect(document.querySelector('.rich-markdown-editor')).not.toBeNull()
    expect(screen.getByRole('heading', { level: 1, name: 'Titre' })).toBeDefined()
  })

  it('sanitizes raw HTML embedded in the markdown before rendering', () => {
    render(
      <MarkdownView
        value={'texte <img src=x onerror="window.__pwned = true">'}
        onChange={vi.fn()}
        placeholder="placeholder text"
      />,
    )
    expect(document.querySelector('img[onerror]')).toBeNull()
  })

  it('shows the placeholder text instead of an empty preview box', () => {
    render(<MarkdownView value="" onChange={vi.fn()} placeholder="Rien à afficher pour le moment." />)
    expect(screen.getByText('Rien à afficher pour le moment.')).toBeDefined()
  })
})
