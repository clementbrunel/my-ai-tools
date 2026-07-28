import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import MatchHeader from './MatchHeader';
import { makeMatch, TEAM_FRANCE, TEAM_BRESIL } from '@/test-utils/factories';
import { renderWithRouter } from '@/test-utils/render-helpers';

describe('MatchHeader — match à venir', () => {
  const match = makeMatch({
    status: 'UPCOMING',
    teamA: TEAM_FRANCE,
    teamB: TEAM_BRESIL,
    round: 'Finale',
    matchDate: '2026-07-01T20:00:00Z',
  });

  it('affiche les deux noms d\'équipe', () => {
    renderWithRouter(<MatchHeader match={match} />);
    expect(screen.getByText('France')).toBeInTheDocument();
    expect(screen.getByText('Brésil')).toBeInTheDocument();
  });

  it('affiche "VS" au lieu du score', () => {
    renderWithRouter(<MatchHeader match={match} />);
    expect(screen.getByText('VS')).toBeInTheDocument();
  });

  it('affiche le round et la compétition', () => {
    renderWithRouter(<MatchHeader match={match} />);
    expect(screen.getByText('Finale')).toBeInTheDocument();
    expect(screen.getByText(match.competition.name)).toBeInTheDocument();
  });
});

describe('MatchHeader — match en cours', () => {
  const match = makeMatch({ status: 'ONGOING', scoreA: 1, scoreB: 0 });

  it('affiche le score courant', () => {
    renderWithRouter(<MatchHeader match={match} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('affiche le badge "EN DIRECT"', () => {
    renderWithRouter(<MatchHeader match={match} />);
    expect(screen.getByText(/EN DIRECT/)).toBeInTheDocument();
  });
});

describe('MatchHeader — match terminé', () => {
  const match = makeMatch({ status: 'FINISHED', scoreA: 2, scoreB: 2 });

  it('affiche le score final sans badge "EN DIRECT"', () => {
    renderWithRouter(<MatchHeader match={match} />);
    expect(screen.getAllByText('2')).toHaveLength(2);
    expect(screen.queryByText(/EN DIRECT/)).not.toBeInTheDocument();
  });

  it('affiche "-" pour les scores manquants (+ le séparateur central)', () => {
    const noScoreMatch = makeMatch({ status: 'FINISHED', scoreA: undefined, scoreB: undefined });
    renderWithRouter(<MatchHeader match={noScoreMatch} />);
    // 2 scores manquants + le tiret séparateur entre les deux
    expect(screen.getAllByText('-')).toHaveLength(3);
  });
});

describe('MatchHeader — liens équipes', () => {
  const match = makeMatch({ teamA: TEAM_FRANCE, teamB: TEAM_BRESIL });

  it("pointe vers la page de l'équipe A", () => {
    renderWithRouter(<MatchHeader match={match} />);
    expect(screen.getByText('France').closest('a')).toHaveAttribute('href', `/foot/teams/${TEAM_FRANCE.id}`);
  });

  it("pointe vers la page de l'équipe B", () => {
    renderWithRouter(<MatchHeader match={match} />);
    expect(screen.getByText('Brésil').closest('a')).toHaveAttribute('href', `/foot/teams/${TEAM_BRESIL.id}`);
  });
});
