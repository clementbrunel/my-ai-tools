import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NotifyMatchesPanel from './NotifyMatchesPanel';
import { makeMatch } from '@/test-utils/factories';
import type { Race } from '@/types';
import {
  getFutureOpenMatches, notifyNewMatches,
  getFutureOpenRaces, notifyNewRaces,
} from '@/api/groups';

vi.mock('@/api/groups', () => ({
  getFutureOpenMatches: vi.fn(),
  notifyNewMatches: vi.fn(),
  getFutureOpenRaces: vi.fn(),
  notifyNewRaces: vi.fn(),
}));

const makeRace = (overrides?: Partial<Race>): Race => ({
  id: 1,
  round: 1,
  name: 'GP de Monaco',
  qualifyingDate: '2026-07-01T14:00:00Z',
  raceDate: '2026-07-02T14:00:00Z',
  status: 'UPCOMING',
  competitionId: 1,
  openInUserGroups: true,
  userPredicted: false,
  predictionsCount: 0,
  ...overrides,
});

describe('NotifyMatchesPanel — fermé', () => {
  it("ne charge rien et n'affiche rien quand isOpen=false", () => {
    const { container } = render(<NotifyMatchesPanel groupId={1} isOpen={false} groupSports={['FOOT']} />);
    expect(container).toBeEmptyDOMElement();
    expect(getFutureOpenMatches).not.toHaveBeenCalled();
  });
});

describe('NotifyMatchesPanel — sport FOOT', () => {
  beforeEach(() => vi.clearAllMocks());

  it('charge et affiche les matchs futurs ouverts', async () => {
    vi.mocked(getFutureOpenMatches).mockResolvedValue([makeMatch({ id: 5 })]);

    render(<NotifyMatchesPanel groupId={7} isOpen={true} groupSports={['FOOT']} />);

    expect(await screen.findByText('France – Brésil')).toBeInTheDocument();
    expect(getFutureOpenMatches).toHaveBeenCalledWith(7);
  });

  it('affiche un message si aucun match futur', async () => {
    vi.mocked(getFutureOpenMatches).mockResolvedValue([]);
    render(<NotifyMatchesPanel groupId={7} isOpen={true} groupSports={['FOOT']} />);
    expect(await screen.findByText(/Aucun match futur ouvert/)).toBeInTheDocument();
  });

  it('envoie la notification pour les matchs sélectionnés', async () => {
    vi.mocked(getFutureOpenMatches).mockResolvedValue([makeMatch({ id: 5 })]);
    vi.mocked(notifyNewMatches).mockResolvedValue(undefined);

    render(<NotifyMatchesPanel groupId={7} isOpen={true} groupSports={['FOOT']} />);
    await screen.findByText('France – Brésil');

    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByText(/Notifier les membres/));

    expect(notifyNewMatches).toHaveBeenCalledWith(7, [5]);
    expect(await screen.findByText(/notifiés par email/)).toBeInTheDocument();
  });

  it("n'affiche pas le bouton d'envoi tant qu'aucun match n'est sélectionné", async () => {
    vi.mocked(getFutureOpenMatches).mockResolvedValue([makeMatch({ id: 5 })]);
    render(<NotifyMatchesPanel groupId={7} isOpen={true} groupSports={['FOOT']} />);
    await screen.findByText('France – Brésil');

    expect(screen.queryByText(/Notifier les membres/)).not.toBeInTheDocument();
  });
});

describe('NotifyMatchesPanel — sport F1', () => {
  beforeEach(() => vi.clearAllMocks());

  it('charge et affiche les GP futurs ouverts', async () => {
    vi.mocked(getFutureOpenRaces).mockResolvedValue([makeRace({ id: 9, name: 'GP de Monaco' })]);

    render(<NotifyMatchesPanel groupId={7} isOpen={true} groupSports={['F1']} />);

    expect(await screen.findByText('GP de Monaco')).toBeInTheDocument();
    expect(getFutureOpenRaces).toHaveBeenCalledWith(7);
  });

  it('envoie la notification pour les GP sélectionnés', async () => {
    vi.mocked(getFutureOpenRaces).mockResolvedValue([makeRace({ id: 9 })]);
    vi.mocked(notifyNewRaces).mockResolvedValue(undefined);

    render(<NotifyMatchesPanel groupId={7} isOpen={true} groupSports={['F1']} />);
    await screen.findByText('GP de Monaco');

    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByText(/Notifier les membres/));

    expect(notifyNewRaces).toHaveBeenCalledWith(7, [9]);
  });
});

describe('NotifyMatchesPanel — bascule de sport', () => {
  it('affiche les PillTabs seulement si plusieurs sports', async () => {
    vi.mocked(getFutureOpenMatches).mockResolvedValue([]);
    const { rerender } = render(<NotifyMatchesPanel groupId={7} isOpen={true} groupSports={['FOOT']} />);
    await waitFor(() => expect(getFutureOpenMatches).toHaveBeenCalled());
    expect(screen.queryByText('⚽ Foot')).not.toBeInTheDocument();

    vi.mocked(getFutureOpenRaces).mockResolvedValue([]);
    rerender(<NotifyMatchesPanel groupId={7} isOpen={true} groupSports={['FOOT', 'F1']} />);
    expect(screen.getByText('⚽ Foot')).toBeInTheDocument();
    expect(screen.getByText('🏎 F1')).toBeInTheDocument();
  });

  it("bascule automatiquement et recharge si le sport affiché n'est plus joué par le groupe", async () => {
    vi.mocked(getFutureOpenRaces).mockResolvedValue([makeRace({ id: 9, name: 'GP de Monaco' })]);
    const { rerender } = render(<NotifyMatchesPanel groupId={7} isOpen={true} groupSports={['F1']} />);
    await screen.findByText('GP de Monaco');

    vi.mocked(getFutureOpenMatches).mockResolvedValue([makeMatch({ id: 5 })]);
    rerender(<NotifyMatchesPanel groupId={7} isOpen={true} groupSports={['FOOT']} />);

    expect(await screen.findByText('France – Brésil')).toBeInTheDocument();
    expect(getFutureOpenMatches).toHaveBeenCalledWith(7);
  });
});
