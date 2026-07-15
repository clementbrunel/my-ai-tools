import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import DailyGageCard from './DailyGageCard';
import type { DailyGage, Forfeit, DailyGageCandidate } from '@/types';

// ── test factories ────────────────────────────────────────────────────────────

const makeForfeit = (overrides?: Partial<Forfeit>): Forfeit => ({
  id: 1,
  title: 'Croissants pour tous',
  description: 'Apporter des croissants le lundi matin',
  category: 'Nourriture',
  isActive: true,
  timesCompleted: 0,
  voteScore: 0,
  userVote: 0,
  ...overrides,
});

const makeCandidate = (overrides?: Partial<DailyGageCandidate>): DailyGageCandidate => ({
  id: 1,
  forfeit: makeForfeit(),
  voteScore: 0,
  userVote: 0,
  ...overrides,
});

const makeGage = (overrides?: Partial<DailyGage>): DailyGage => ({
  id: 1,
  groupId: 10,
  groupName: 'Les Amis',
  matchDate: '2026-06-15',
  mode: 'DIRECT',
  status: 'ACTIVE',
  candidates: [],
  createdAt: '2026-06-15T00:00:00Z',
  ...overrides,
});

// ── état SETTLED ──────────────────────────────────────────────────────────────

describe('DailyGageCard — état SETTLED', () => {
  const gage = makeGage({
    status: 'SETTLED',
    forfeit: makeForfeit({ title: 'Karaoké solo' }),
    assignedToUsername: 'pierre',
    assignedToDisplayName: 'Pierre Martin',
  });

  it('affiche le libellé "Gage attribué"', () => {
    render(<DailyGageCard gage={gage} onVote={vi.fn()} />);
    expect(screen.getByText('Gage attribué')).toBeInTheDocument();
  });

  it('affiche le titre du gage', () => {
    render(<DailyGageCard gage={gage} onVote={vi.fn()} />);
    expect(screen.getByText('Karaoké solo')).toBeInTheDocument();
  });

  it("affiche le nom d'affichage de la personne assignée", () => {
    render(<DailyGageCard gage={gage} onVote={vi.fn()} />);
    expect(screen.getByText(/Pierre Martin/)).toBeInTheDocument();
  });

  it("replie sur le username si displayName est absent", () => {
    const gageNoDisplay = makeGage({
      status: 'SETTLED',
      forfeit: makeForfeit(),
      assignedToUsername: 'pierre',
      assignedToDisplayName: undefined,
    });
    render(<DailyGageCard gage={gageNoDisplay} onVote={vi.fn()} />);
    expect(screen.getByText(/pierre/)).toBeInTheDocument();
  });

  it("n'affiche pas les boutons de vote", () => {
    render(<DailyGageCard gage={gage} onVote={vi.fn()} />);
    expect(screen.queryByTitle('Pour')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Contre')).not.toBeInTheDocument();
  });
});

// ── mode DIRECT ───────────────────────────────────────────────────────────────

describe('DailyGageCard — mode DIRECT', () => {
  const gage = makeGage({
    status: 'ACTIVE',
    mode: 'DIRECT',
    forfeit: makeForfeit({ title: 'Karaoké solo', description: 'Une chanson entière devant le groupe' }),
  });

  it('affiche le titre du gage', () => {
    render(<DailyGageCard gage={gage} onVote={vi.fn()} />);
    expect(screen.getByText('Karaoké solo')).toBeInTheDocument();
  });

  it('affiche la description du gage', () => {
    render(<DailyGageCard gage={gage} onVote={vi.fn()} />);
    expect(screen.getByText('Une chanson entière devant le groupe')).toBeInTheDocument();
  });

  it("n'affiche pas les boutons de vote", () => {
    render(<DailyGageCard gage={gage} onVote={vi.fn()} />);
    expect(screen.queryByTitle('Pour')).not.toBeInTheDocument();
  });

  it("n'affiche pas le mode DIRECT si aucun forfait n'est sélectionné", () => {
    const gageNoForfeit = makeGage({ status: 'ACTIVE', mode: 'DIRECT', forfeit: undefined });
    render(<DailyGageCard gage={gageNoForfeit} onVote={vi.fn()} />);
    expect(screen.queryByText('Gage de la journée')).not.toBeInTheDocument();
  });
});

// ── mode VOTE ─────────────────────────────────────────────────────────────────

describe('DailyGageCard — mode VOTE', () => {
  const candidates = [
    makeCandidate({ id: 1, forfeit: makeForfeit({ id: 10, title: 'Karaoké' }), voteScore: 2, userVote: 0 }),
    makeCandidate({ id: 2, forfeit: makeForfeit({ id: 11, title: 'Pompes' }),  voteScore: -1, userVote: 0 }),
  ];
  const gage = makeGage({ mode: 'VOTE', candidates });

  it('affiche tous les titres candidats', () => {
    render(<DailyGageCard gage={gage} onVote={vi.fn()} />);
    expect(screen.getByText('Karaoké')).toBeInTheDocument();
    expect(screen.getByText('Pompes')).toBeInTheDocument();
  });

  it('affiche les scores de vote', () => {
    render(<DailyGageCard gage={gage} onVote={vi.fn()} />);
    expect(screen.getByText('+2')).toBeInTheDocument();
    expect(screen.getByText('-1')).toBeInTheDocument();
  });

  it('affiche un bouton Pour et Contre par candidat', () => {
    render(<DailyGageCard gage={gage} onVote={vi.fn()} />);
    expect(screen.getAllByTitle('Pour')).toHaveLength(2);
    expect(screen.getAllByTitle('Contre')).toHaveLength(2);
  });

  it('appelle onVote(gageId, forfeitId, 1) au clic Pour', async () => {
    const onVote = vi.fn();
    render(<DailyGageCard gage={gage} onVote={onVote} />);
    await userEvent.click(screen.getAllByTitle('Pour')[0]);
    expect(onVote).toHaveBeenCalledWith(1, 10, 1);
  });

  it('appelle onVote(gageId, forfeitId, -1) au clic Contre', async () => {
    const onVote = vi.fn();
    render(<DailyGageCard gage={gage} onVote={onVote} />);
    await userEvent.click(screen.getAllByTitle('Contre')[1]);
    expect(onVote).toHaveBeenCalledWith(1, 11, -1);
  });

  it('toggle Pour → repasse à 0 si déjà liké (userVote === 1)', async () => {
    const onVote = vi.fn();
    const gageWithLike = makeGage({
      mode: 'VOTE',
      candidates: [makeCandidate({ id: 1, forfeit: makeForfeit({ id: 10 }), userVote: 1 })],
    });
    render(<DailyGageCard gage={gageWithLike} onVote={onVote} />);
    await userEvent.click(screen.getByTitle('Pour'));
    expect(onVote).toHaveBeenCalledWith(1, 10, 0);
  });

  it('toggle Contre → repasse à 0 si déjà disliké (userVote === -1)', async () => {
    const onVote = vi.fn();
    const gageWithDislike = makeGage({
      mode: 'VOTE',
      candidates: [makeCandidate({ id: 1, forfeit: makeForfeit({ id: 10 }), userVote: -1 })],
    });
    render(<DailyGageCard gage={gageWithDislike} onVote={onVote} />);
    await userEvent.click(screen.getByTitle('Contre'));
    expect(onVote).toHaveBeenCalledWith(1, 10, 0);
  });
});

// ── état en attente (PENDING / pas de config) ─────────────────────────────────

describe('DailyGageCard — en attente', () => {
  it('affiche le message en attente si VOTE sans candidats', () => {
    const gage = makeGage({ mode: 'VOTE', candidates: [] });
    render(<DailyGageCard gage={gage} onVote={vi.fn()} />);
    expect(screen.getByText(/en attente de configuration/)).toBeInTheDocument();
  });

  it('affiche le message en attente si DIRECT sans forfait', () => {
    const gage = makeGage({ mode: 'DIRECT', forfeit: undefined });
    render(<DailyGageCard gage={gage} onVote={vi.fn()} />);
    expect(screen.getByText(/en attente de configuration/)).toBeInTheDocument();
  });
});

// ── prop showGroupName ────────────────────────────────────────────────────────

describe('DailyGageCard — showGroupName', () => {
  const gage = makeGage({ mode: 'DIRECT', forfeit: makeForfeit() });

  it("affiche le nom du groupe si showGroupName=true", () => {
    render(<DailyGageCard gage={gage} onVote={vi.fn()} showGroupName />);
    expect(screen.getByText(/Les Amis/)).toBeInTheDocument();
  });

  it("n'affiche pas le nom du groupe par défaut", () => {
    render(<DailyGageCard gage={gage} onVote={vi.fn()} />);
    expect(screen.queryByText(/Les Amis/)).not.toBeInTheDocument();
  });
});
