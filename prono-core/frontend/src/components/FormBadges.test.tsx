import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FormBadges from './FormBadges';

describe('FormBadges', () => {
  it('affiche une pastille V/N/D par résultat, dans l\'ordre', () => {
    render(<FormBadges outcomes={['W', 'D', 'L']} />);
    expect(screen.getAllByText(/^[VND]$/).map((el) => el.textContent)).toEqual(['V', 'N', 'D']);
  });

  it('ne rend rien sans forme ou avec une forme vide', () => {
    const { container, rerender } = render(<FormBadges outcomes={undefined} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<FormBadges outcomes={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
