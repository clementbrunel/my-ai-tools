import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Header from './Header'

describe('Header', () => {
  it('renders the app name', () => {
    render(<Header />)
    expect(screen.getByText('Spec Doc/JXML Merger')).toBeDefined()
  })
})
