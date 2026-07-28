import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import OthersPredictions from './OthersPredictions';
import * as AuthContextModule from '@/context/AuthContext';
import { makeMockAuth } from '@/test-utils/auth-mock';
import { makeBet, makeBetParticipation, makeUser } from '@/test-utils/factories';

const asUser = (username: string) => {
  vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(makeMockAuth({ user: makeUser({ username }) }));
};

beforeEach(() => {
  vi.restoreAllMocks();
  asUser('moi');
});

describe('OthersPredictions — avant la date limite (showOthers=false)', () => {
  it('affiche uniquement le nombre de pronostics déposés', () => {
    const bet = makeBet({ status: 'OPEN' });
    const participations = [makeBetParticipation({ id: 1 }), makeBetParticipation({ id: 2 })];
    render(<OthersPredictions bet={bet} participations={participations} showOthers={false} />);
    expect(screen.getByText(/2 pronostics/)).toBeInTheDocument();
    expect(screen.queryByText(/Pronostics \(/)).not.toBeInTheDocument();
  });

  it('gère le singulier pour un seul pronostic', () => {
    const bet = makeBet({ status: 'OPEN' });
    const { container } = render(<OthersPredictions bet={bet} participations={[makeBetParticipation()]} showOthers={false} />);
    expect(container.textContent).toMatch(/1 pronostic déposé/);
    expect(container.textContent).not.toMatch(/pronostics/);
  });

  it('affiche "0 pronostic" si personne n\'a encore participé', () => {
    const bet = makeBet({ status: 'OPEN' });
    render(<OthersPredictions bet={bet} participations={[]} showOthers={false} />);
    expect(screen.getByText(/0 pronostic/)).toBeInTheDocument();
  });

  it('ne révèle jamais les choix des autres joueurs', () => {
    const bet = makeBet({ status: 'OPEN' });
    const participations = [makeBetParticipation({ chosenOption: 'Victoire France 2-0' })];
    render(<OthersPredictions bet={bet} participations={participations} showOthers={false} />);
    expect(screen.queryByText('Victoire France 2-0')).not.toBeInTheDocument();
  });
});

describe('OthersPredictions — après la date limite (showOthers=true)', () => {
  it("n'affiche rien si personne n'a participé", () => {
    const bet = makeBet({ status: 'VALIDATED' });
    const { container } = render(<OthersPredictions bet={bet} participations={[]} showOthers />);
    expect(container).toBeEmptyDOMElement();
  });

  it('révèle les pronostics de chaque joueur', () => {
    const bet = makeBet({ status: 'OPEN' });
    const participations = [
      makeBetParticipation({ id: 1, user: makeUser({ username: 'alice', displayName: 'Alice' }), chosenOption: 'Victoire France 2-0' }),
      makeBetParticipation({ id: 2, user: makeUser({ username: 'bob', displayName: 'Bob' }), chosenOption: 'Match nul 1-1' }),
    ];
    render(<OthersPredictions bet={bet} participations={participations} showOthers />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Victoire France 2-0')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Match nul 1-1')).toBeInTheDocument();
  });

  it('marque le joueur courant avec "(moi)"', () => {
    const bet = makeBet({ status: 'OPEN' });
    const participations = [makeBetParticipation({ user: makeUser({ username: 'moi', displayName: 'Moi' }) })];
    render(<OthersPredictions bet={bet} participations={participations} showOthers />);
    expect(screen.getByText('(moi)')).toBeInTheDocument();
  });

  it('affiche le résultat officiel une fois le pari validé', () => {
    const bet = makeBet({ status: 'VALIDATED', winningOption: 'Victoire France 2-0' });
    render(<OthersPredictions bet={bet} participations={[makeBetParticipation()]} showOthers />);
    expect(screen.getByText(/Résultat officiel : Victoire France 2-0/)).toBeInTheDocument();
  });

  it('affiche les points gagnés par joueur une fois le pari validé', () => {
    const bet = makeBet({ status: 'VALIDATED', winningOption: 'Victoire France 2-0' });
    const participations = [makeBetParticipation({ chosenOption: 'Victoire France 2-0' })];
    render(<OthersPredictions bet={bet} participations={participations} showOthers />);
    expect(screen.getByText(/\+5 pts/)).toBeInTheDocument();
  });

  it("n'affiche pas de points tant que le pari n'est pas validé", () => {
    const bet = makeBet({ status: 'OPEN' });
    const participations = [makeBetParticipation({ chosenOption: 'Victoire France 2-0' })];
    render(<OthersPredictions bet={bet} participations={participations} showOthers />);
    expect(screen.queryByText(/pts/)).not.toBeInTheDocument();
  });

  it('affiche le commentaire du joueur si présent', () => {
    const bet = makeBet({ status: 'OPEN' });
    const participations = [makeBetParticipation({ comment: 'On y croit !' })];
    render(<OthersPredictions bet={bet} participations={participations} showOthers />);
    expect(screen.getByText('"On y croit !"')).toBeInTheDocument();
  });
});
