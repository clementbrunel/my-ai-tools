import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import DivergencesTable from './DivergencesTable'
import type { Divergence } from '../types'

const divergences: Divergence[] = [
  {
    id: 'd1',
    sectionRef: '2.1',
    wordExcerpt: '5 Mo max',
    jxmlExcerpt: '10 Mo max',
    aiProposal: 'Aligner sur 5 Mo (spec Word)',
    resolutionStatus: 'PENDING',
    resolvedValue: null,
  },
]

describe('DivergencesTable', () => {
  it('renders nothing when there are no divergences', () => {
    const { container } = render(<DivergencesTable divergences={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the divergence count and each row', () => {
    render(<DivergencesTable divergences={divergences} />)
    expect(screen.getByText('Divergences détectées (1)')).toBeDefined()
    expect(screen.getByText('2.1')).toBeDefined()
    expect(screen.getByText('5 Mo max')).toBeDefined()
    expect(screen.getByText('10 Mo max')).toBeDefined()
    expect(screen.getByText('Aligner sur 5 Mo (spec Word)')).toBeDefined()
  })

  it('renders an em dash for null excerpts and proposal', () => {
    render(
      <DivergencesTable
        divergences={[
          { ...divergences[0], wordExcerpt: null, jxmlExcerpt: null, aiProposal: null },
        ]}
      />,
    )
    expect(screen.getAllByText('—')).toHaveLength(3)
  })
})
