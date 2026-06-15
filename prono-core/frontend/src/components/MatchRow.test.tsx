import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MatchRow from './MatchRow';
import type { Match } from '../types';

vi.mock('../utils/countryFlags', () => ({
  getFlagUrl: (name: string) => `https://flags.example.com/${name}.png`,
}));

const makeMatch = (overrides?: Partial<Match>): Match => ({
  id: 1,
  teamA: 'Espagne',
  teamB: 'Allemagne',
  matchDate: '2026-07-01T18:00:00Z',
  status: 'UPCOMING',
  competition: 'Coupe du Monde 2026',
  round: 'Demi-finale',
  ...overrides,
});

const renderRow = (match: Match, pronoStatus?: 'done' | 'missing') =>
  render(
    <MemoryRouter>
      <MatchRow match={match} pronoStatus={pronoStatus} />
    </MemoryRouter>
  );

describe('MatchRow — match UPCOMING', () => {
  it('affiche VS', () => {
    renderRow(makeMatch());
    expect(screen.getByText('VS')).toBeDefined();
  });

  it("affiche l'heure", () => {
    renderRow(makeMatch());
    expect(screen.getByText(/\d{2}:\d{2}/)).toBeDefined();
  });

  it('affiche les deux noms d\'équipe', () => {
    renderRow(makeMatch());
    expect(screen.getByText('Espagne')).toBeDefined();
    expect(screen.getByText('Allemagne')).toBeDefined();
  });

  it("n'affiche pas de score", () => {
    renderRow(makeMatch());
    expect(screen.queryByText(/\d+ - \d+/)).toBeNull();
  });
});

describe('MatchRow — match FINISHED', () => {
  const finishedMatch = makeMatch({ status: 'FINISHED', scoreA: 3, scoreB: 0 });

  it('affiche le score', () => {
    renderRow(finishedMatch);
    expect(screen.getByText(/3 - 0/)).toBeDefined();
  });

  it("n'affiche pas VS", () => {
    renderRow(finishedMatch);
    expect(screen.queryByText('VS')).toBeNull();
  });
});

describe('MatchRow — pronoStatus', () => {
  it('affiche "Saisi" si pronoStatus=done', () => {
    renderRow(makeMatch(), 'done');
    expect(screen.getByText(/Saisi/)).toBeDefined();
  });

  it('affiche "À saisir" si pronoStatus=missing', () => {
    renderRow(makeMatch(), 'missing');
    expect(screen.getByText(/À saisir/)).toBeDefined();
  });

  it("n'affiche pas d'indicateur de prono si absent", () => {
    renderRow(makeMatch());
    expect(screen.queryByText(/Saisi/)).toBeNull();
    expect(screen.queryByText(/À saisir/)).toBeNull();
  });
});

describe('MatchRow — drapeaux', () => {
  it('rend les images de drapeau pour chaque équipe', () => {
    renderRow(makeMatch());
    const imgs = screen.getAllByRole('img');
    const srcs = imgs.map((img) => (img as HTMLImageElement).src);
    expect(srcs.some((s) => s.includes('Espagne'))).toBe(true);
    expect(srcs.some((s) => s.includes('Allemagne'))).toBe(true);
  });
});
