import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import MatchCard from './MatchCard';
import { makeMatch } from '../test-utils/factories';
import { renderWithRouter } from '../test-utils/render-helpers';

vi.mock('../utils/countryFlags');

const renderCard = (match = makeMatch(), pronoStatus?: 'done' | 'missing') =>
  renderWithRouter(<MatchCard match={match} pronoStatus={pronoStatus} />);

describe('MatchCard — match UPCOMING', () => {
  it('affiche VS et non un score', () => {
    renderCard();
    expect(screen.getByText('VS')).toBeDefined();
    expect(screen.queryByText(/^\d+ - \d+$/)).toBeNull();
  });

  it("affiche l'heure du match", () => {
    renderCard(makeMatch({ matchDate: '2026-07-01T20:00:00Z' }));
    expect(screen.getByText(/\d{2}:\d{2}/)).toBeDefined();
  });

  // Régression : un match à minuit ne doit pas afficher la veille
  it('affiche la bonne date pour un match à minuit sans décalage timezone', () => {
    renderCard(makeMatch({ matchDate: '2026-06-11T00:00:00' }));
    expect(screen.getByText('11/06/2026')).toBeDefined();
    expect(screen.queryByText('10/06/2026')).toBeNull();
  });

  it('affiche 00:00 pour un match à minuit', () => {
    renderCard(makeMatch({ matchDate: '2026-06-11T00:00:00' }));
    expect(screen.getByText('00:00')).toBeDefined();
  });

  it('affiche les noms des deux équipes', () => {
    renderCard();
    expect(screen.getByText('France')).toBeDefined();
    expect(screen.getByText('Brésil')).toBeDefined();
  });

  it('affiche le badge statut À venir', () => {
    renderCard();
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
    renderCard();
    expect(screen.queryByText(/Prono saisi/)).toBeNull();
    expect(screen.queryByText(/À saisir/)).toBeNull();
  });
});

describe('MatchCard — drapeaux', () => {
  it('affiche les drapeaux des deux équipes via img', () => {
    renderCard(makeMatch({ teamAIso2: 'fr', teamBIso2: 'br' }));
    const imgs = screen.getAllByRole('img');
    const srcs = imgs.map((img) => (img as HTMLImageElement).src);
    expect(srcs.some((s) => s.includes('fr'))).toBe(true);
    expect(srcs.some((s) => s.includes('br'))).toBe(true);
  });

  it('affiche un drapeau générique si iso2 absent', () => {
    renderCard(makeMatch({ teamAIso2: null, teamBIso2: null }));
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getAllByText('🏳️').length).toBe(2);
  });
});
