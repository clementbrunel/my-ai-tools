import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import MatchRow from './MatchRow';
import { makeMatch } from '../test-utils/factories';
import { renderWithRouter } from '../test-utils/render-helpers';

vi.mock('../utils/countryFlags');

const renderRow = (match = makeMatch(), pronoStatus?: 'done' | 'missing') =>
  renderWithRouter(<MatchRow match={match} pronoStatus={pronoStatus} />);

describe('MatchRow — match UPCOMING', () => {
  it('affiche VS', () => {
    renderRow();
    expect(screen.getByText('VS')).toBeDefined();
  });

  it("affiche l'heure", () => {
    renderRow();
    expect(screen.getByText(/\d{2}:\d{2}/)).toBeDefined();
  });

  // Régression : un match à minuit ne doit pas afficher la veille
  it('affiche la bonne date pour un match à minuit sans décalage timezone', () => {
    renderRow(makeMatch({ matchDate: '2026-06-11T00:00:00' }));
    expect(screen.getByText('11/06/2026')).toBeDefined();
    expect(screen.queryByText('10/06/2026')).toBeNull();
  });

  it('affiche 00:00 pour un match à minuit', () => {
    renderRow(makeMatch({ matchDate: '2026-06-11T00:00:00' }));
    expect(screen.getByText('00:00')).toBeDefined();
  });

  it("affiche les deux noms d'équipe", () => {
    renderRow();
    expect(screen.getByText('France')).toBeDefined();
    expect(screen.getByText('Brésil')).toBeDefined();
  });

  it("n'affiche pas de score", () => {
    renderRow();
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
    renderRow();
    expect(screen.queryByText(/Saisi/)).toBeNull();
    expect(screen.queryByText(/À saisir/)).toBeNull();
  });
});

describe('MatchRow — drapeaux', () => {
  it('rend les images de drapeau pour chaque équipe', () => {
    renderRow(makeMatch({ teamA: 'Espagne', teamB: 'Allemagne' }));
    const imgs = screen.getAllByRole('img');
    const srcs = imgs.map((img) => (img as HTMLImageElement).src);
    expect(srcs.some((s) => s.includes('Espagne'))).toBe(true);
    expect(srcs.some((s) => s.includes('Allemagne'))).toBe(true);
  });
});
