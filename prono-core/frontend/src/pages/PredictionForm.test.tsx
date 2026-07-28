import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PredictionForm from './PredictionForm';
import * as AuthContextModule from '@/context/AuthContext';
import * as MatchesContextModule from '@/context/MatchesContext';
import * as betsApi from '@/api/bets';
import { makeMockAuth } from '@/test-utils/auth-mock';
import { makeBet, makeBetParticipation, makeMatch, makeUser, TEAM_FRANCE, TEAM_BRESIL } from '@/test-utils/factories';

const markParticipated = vi.fn();

const asUser = (username: string) => {
  vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(makeMockAuth({ user: makeUser({ username }) }));
};

beforeEach(() => {
  vi.restoreAllMocks();
  asUser('moi');
  vi.spyOn(MatchesContextModule, 'useMatches').mockReturnValue({
    matches: [],
    hasGroups: true,
    isLoading: false,
    fetchIfNeeded: vi.fn(),
    markParticipated,
  });
});

const POOL_MATCH = makeMatch({ phase: 'POOL', teamA: TEAM_FRANCE, teamB: TEAM_BRESIL });
const KNOCKOUT_MATCH = makeMatch({ phase: 'KNOCKOUT', teamA: TEAM_FRANCE, teamB: TEAM_BRESIL });

describe('PredictionForm — pari ouvert (canBet=true)', () => {
  it('affiche les champs de score et le bouton de validation', () => {
    const bet = makeBet({ status: 'OPEN' });
    render(<PredictionForm match={POOL_MATCH} bet={bet} participations={[]} canBet refreshParticipations={vi.fn()} />);
    expect(screen.getByText('France')).toBeInTheDocument();
    expect(screen.getByText('Brésil')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Valider mon prono/ })).toBeInTheDocument();
  });

  it('ne propose pas la sélection du vainqueur en phase de poule', () => {
    const bet = makeBet({ status: 'OPEN' });
    render(<PredictionForm match={POOL_MATCH} bet={bet} participations={[]} canBet refreshParticipations={vi.fn()} />);
    expect(screen.queryByText('Qui gagne ?')).not.toBeInTheDocument();
  });

  it('propose la sélection du vainqueur en phase KNOCKOUT', () => {
    const bet = makeBet({ status: 'OPEN' });
    render(<PredictionForm match={KNOCKOUT_MATCH} bet={bet} participations={[]} canBet refreshParticipations={vi.fn()} />);
    expect(screen.getByText('Qui gagne ?')).toBeInTheDocument();
  });

  it('affiche le bloc t.a.b. quand le score redevient égal après un vainqueur choisi', async () => {
    const user = userEvent.setup();
    const bet = makeBet({ status: 'OPEN' });
    render(<PredictionForm match={KNOCKOUT_MATCH} bet={bet} participations={[]} canBet refreshParticipations={vi.fn()} />);

    const scoreInputs = screen.getAllByRole('spinbutton');
    // 2-1 → auto-correction : France est désignée vainqueur
    await user.clear(scoreInputs[0]);
    await user.type(scoreInputs[0], '2');
    await user.clear(scoreInputs[1]);
    await user.type(scoreInputs[1], '1');
    // Le score revient à égalité (2-2) sans changer le vainqueur choisi
    await user.type(scoreInputs[1], '{backspace}2');

    expect(screen.getByText(/gagne aux t\.a\.b\./)).toBeInTheDocument();
  });

  it('affiche la prévisualisation du pronostic au fur et à mesure de la saisie', async () => {
    const user = userEvent.setup();
    const bet = makeBet({ status: 'OPEN' });
    render(<PredictionForm match={POOL_MATCH} bet={bet} participations={[]} canBet refreshParticipations={vi.fn()} />);

    const scoreInputs = screen.getAllByRole('spinbutton');
    await user.clear(scoreInputs[0]);
    await user.type(scoreInputs[0], '3');
    await user.clear(scoreInputs[1]);
    await user.type(scoreInputs[1], '1');

    expect(screen.getByText('Victoire France 3-1')).toBeInTheDocument();
  });

  it('désactive le bouton de validation tant que le pronostic est incomplet', async () => {
    const user = userEvent.setup();
    const bet = makeBet({ status: 'OPEN' });
    render(<PredictionForm match={KNOCKOUT_MATCH} bet={bet} participations={[]} canBet refreshParticipations={vi.fn()} />);

    // 0-0 sans vainqueur choisi → pas de prévisualisation valide
    expect(screen.getByRole('button', { name: /Valider mon prono/ })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'France' }));
    expect(screen.getByRole('button', { name: /Valider mon prono/ })).not.toBeDisabled();
  });

  it('envoie le pronostic prévisualisé à la soumission et rafraîchit les participations', async () => {
    const user = userEvent.setup();
    const bet = makeBet({ status: 'OPEN' });
    const refreshParticipations = vi.fn().mockResolvedValue([]);
    const upsertSpy = vi.spyOn(betsApi, 'upsertParticipateByMatch').mockResolvedValue([]);

    render(<PredictionForm match={POOL_MATCH} bet={bet} participations={[]} canBet refreshParticipations={refreshParticipations} />);

    const scoreInputs = screen.getAllByRole('spinbutton');
    await user.clear(scoreInputs[0]);
    await user.type(scoreInputs[0], '2');
    await user.clear(scoreInputs[1]);
    await user.type(scoreInputs[1], '0');

    await user.click(screen.getByRole('button', { name: /Valider mon prono/ }));

    expect(upsertSpy).toHaveBeenCalledWith(POOL_MATCH.id, 'Victoire France 2-0', undefined);
    expect(refreshParticipations).toHaveBeenCalled();
    expect(markParticipated).toHaveBeenCalledWith(POOL_MATCH.id);
    expect(await screen.findByText(/enregistré/)).toBeInTheDocument();
  });

  it("affiche un message d'erreur si l'enregistrement échoue", async () => {
    const user = userEvent.setup();
    const bet = makeBet({ status: 'OPEN' });
    vi.spyOn(betsApi, 'upsertParticipateByMatch').mockRejectedValue({
      response: { data: { message: 'Le pari est fermé' } },
    });

    render(<PredictionForm match={POOL_MATCH} bet={bet} participations={[]} canBet refreshParticipations={vi.fn()} />);

    const scoreInputs = screen.getAllByRole('spinbutton');
    await user.clear(scoreInputs[0]);
    await user.type(scoreInputs[0], '2');
    await user.clear(scoreInputs[1]);
    await user.type(scoreInputs[1], '0');
    await user.click(screen.getByRole('button', { name: /Valider mon prono/ }));

    expect(await screen.findByText(/Le pari est fermé/)).toBeInTheDocument();
  });

  it('affiche "✓ déposé" si le joueur a déjà participé', () => {
    const bet = makeBet({ status: 'OPEN' });
    const participations = [makeBetParticipation({ user: makeUser({ username: 'moi' }) })];
    render(<PredictionForm match={POOL_MATCH} bet={bet} participations={participations} canBet refreshParticipations={vi.fn()} />);
    expect(screen.getByText('✓ déposé')).toBeInTheDocument();
  });
});

describe('PredictionForm — pari fermé (canBet=false)', () => {
  it('affiche le pronostic déjà déposé sans formulaire', () => {
    const bet = makeBet({ status: 'OPEN' });
    const participations = [makeBetParticipation({ user: makeUser({ username: 'moi' }), chosenOption: 'Victoire France 2-0', comment: 'Facile' })];
    render(<PredictionForm match={POOL_MATCH} bet={bet} participations={participations} canBet={false} refreshParticipations={vi.fn()} />);

    expect(screen.getByText('Victoire France 2-0')).toBeInTheDocument();
    expect(screen.getByText('"Facile"')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Valider mon prono/ })).not.toBeInTheDocument();
  });

  it("indique l'absence de participation si le joueur n'a pas parié", () => {
    const bet = makeBet({ status: 'OPEN' });
    render(<PredictionForm match={POOL_MATCH} bet={bet} participations={[]} canBet={false} refreshParticipations={vi.fn()} />);
    expect(screen.getByText(/Tu n'as pas participé à ce pari/)).toBeInTheDocument();
  });

  it('indique que le pari a été annulé', () => {
    const bet = makeBet({ status: 'CANCELLED' });
    render(<PredictionForm match={POOL_MATCH} bet={bet} participations={[]} canBet={false} refreshParticipations={vi.fn()} />);
    expect(screen.getByText('Pari annulé.')).toBeInTheDocument();
  });

  it('affiche les points gagnés une fois le pari validé', () => {
    const bet = makeBet({ status: 'VALIDATED', winningOption: 'Victoire France 2-0' });
    const participations = [makeBetParticipation({ user: makeUser({ username: 'moi' }), chosenOption: 'Victoire France 2-0' })];
    render(<PredictionForm match={POOL_MATCH} bet={bet} participations={participations} canBet={false} refreshParticipations={vi.fn()} />);
    expect(screen.getByText(/Score exact.*\+5 pts/)).toBeInTheDocument();
  });

  it('affiche "Raté" si le pronostic est faux', () => {
    const bet = makeBet({ status: 'VALIDATED', winningOption: 'Victoire France 2-0' });
    const participations = [makeBetParticipation({ user: makeUser({ username: 'moi' }), chosenOption: 'Victoire Brésil 1-0' })];
    render(<PredictionForm match={POOL_MATCH} bet={bet} participations={participations} canBet={false} refreshParticipations={vi.fn()} />);
    expect(screen.getByText(/Raté — 0 pt/)).toBeInTheDocument();
  });
});
