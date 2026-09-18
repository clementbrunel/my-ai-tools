import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import MergePanel from './MergePanel'

describe('MergePanel', () => {
  it('shows the not-yet-available message for the merge/diff feature', () => {
    render(<MergePanel />)
    expect(screen.getByText('Fusion')).toBeDefined()
    expect(screen.getByText(/arrivent bientôt/)).toBeDefined()
  })
})
