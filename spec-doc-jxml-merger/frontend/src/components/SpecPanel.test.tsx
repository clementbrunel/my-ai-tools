import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SpecPanel from './SpecPanel'

describe('SpecPanel', () => {
  it('renders the section label', () => {
    render(<SpecPanel wordFile={null} onWordFileChange={vi.fn()} />)
    expect(screen.getByText('Spec Word (optionnel)')).toBeDefined()
  })

  it('does not show a filename when no file is selected', () => {
    render(<SpecPanel wordFile={null} onWordFileChange={vi.fn()} />)
    expect(screen.queryByText(/\.docx/)).toBeNull()
  })

  it('shows the filename when a file is selected', () => {
    const file = new File(['contenu'], 'KYC_v2.docx')
    render(<SpecPanel wordFile={file} onWordFileChange={vi.fn()} />)
    expect(screen.getByText('KYC_v2.docx')).toBeDefined()
  })

  it('calls onWordFileChange when a file is picked', async () => {
    const onWordFileChange = vi.fn()
    const { container } = render(<SpecPanel wordFile={null} onWordFileChange={onWordFileChange} />)
    const file = new File(['contenu'], 'spec.docx')
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, file)
    expect(onWordFileChange).toHaveBeenCalledWith(file)
  })
})
