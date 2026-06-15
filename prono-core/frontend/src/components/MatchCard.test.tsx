import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MatchCard from './MatchCard';
import type { Match } from '../types';

vi.mock('../utils/countryFlags', () => ({
  getFlagUrl: (name: string) => `https://flags.example.com/${name}.png`,
}));

const makeMatch = (overrides?: Partial<Match>): Match => ({
  id: 1,
  teamA: 'France',
  teamB: 'Brésil',
  matchDate: '2026-07-01T20:00:00Z',
  status: 'UPCOMING',
  competition: 'Coupe du Monde 2026',
  round: 'Finale',
  ...overrides,
});

const renderCard = (match: Match, pronoStatus?: 'done' | 'missing') =>
  render(
    <MemoryRouter>
      <MatchCard match={match} pronoStatus={pronoStatus} />
    </MemoryRouter>
  );

describe('MatchCard — match UPCOMING', () => {
  it('affiche VS et non un score', () => {
    renderCard(makeMatch());
    expect(screen.getByText('VS')).toBeDefined();
    expect(screen.queryByText(/^\d+ - \d+$/)).toBeNull();
  });

  it("affiche l'heure du match", () => {
    renderCard(makeMatch({ matchDate: '2026-07-01T20:00:00Z' }));
    // time is formatted locale-dependently; just check something time-like is shown
    expect(screen.getByText(/\d{2}:\d{2}/)).toBeDefined();
  });

  it('affiche les noms des deux équipes', () => {
    renderCard(makeMatch());
    expect(screen.getByText('France')).toBeDefined();
    expect(screen.getByText('Brésil')).toBeDefined();
  });

  it('affiche le badge statut À venir', () => {
    renderCard(makeMatch());
    expect(screen.getByText(/À venir/)).toBeDefined();
  });
});

describe('MatchCard — match FINISHED', () => {
  const finishedMatch = makeMatch({ status: 'FINISHED', scoreA: 2, scoreB: 1 });

  it('affiche le score', () => {
    renderCard(finishedMatch);
    expect(screen.getByText('2')).toBeDefined();
    expect(screen.getByText('1')).toBeDefined();
  });

  it('affiche le badge Terminé', () => {
    renderCard(finishedMatch);
    expect(screen.getByText(/Terminé/)).toBeDefined();
  });

  it("n'affiche pas VS", () => {
    renderCard(finishedMatch);
    expect(screen.queryByText('VS')).toBeNull();
  });
});

describe('MatchCard — pronoStatus', () => {
  it('affiche "Prono saisi" si pronoStatus=done', () => {
    renderCard(makeMatch(), 'done');
    expect(screen.getByText(/Prono saisi/)).toBeDefined();
  });

  it('affiche "À saisir" si pronoStatus=missing', () => {
    renderCard(makeMatch(), 'missing');
    expect(screen.getByText(/À saisir/)).toBeDefined();
  });

  it("n'affiche pas d'indicateur de prono si pronoStatus absent", () => {
    renderCard(makeMatch());
    expect(screen.queryByText(/Prono saisi/)).toBeNull();
    expect(screen.queryByText(/À saisir/)).toBeNull();
  });
});

describe('MatchCard — drapeaux', () => {
  it('affiche les drapeaux des deux équipes via img', () => {
    renderCard(makeMatch());
    const imgs = screen.getAllByRole('img');
    const srcs = imgs.map((img) => (img as HTMLImageElement).src);
    expect(srcs.some((s) => s.includes('France'))).toBe(true);
    expect(srcs.some((s) => s.includes('Br'))).toBe(true);
  });
});
