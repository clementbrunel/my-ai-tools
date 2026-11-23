import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QualifyingGridEditor from './QualifyingGridEditor';
import { ToastProvider } from '@/components/Toast';
import { enterQualifyingResults } from '@/api/f1';
import type { Driver, Race } from '@/types';

vi.mock('@/api/f1', () => ({ enterQualifyingResults: vi.fn() }));

const driver = (id: number, code: string): Driver => ({
  id, code, name: code, number: id, constructorId: 1, constructorName: 'McLaren', constructorColor: '#FF8000',
} as Driver);

const nor = driver(1, 'NOR');
const lec = driver(2, 'LEC');
const ver = driver(3, 'VER');

const race: Race = {
  id: 10, round: 1, name: 'GP Test',
  qualifyingDate: '2026-01-01T14:00:00Z', raceDate: '2026-01-02T14:00:00Z',
  status: 'UPCOMING', competitionId: 1, openInUserGroups: true, userPredicted: false, predictionsCount: 0,
};

const renderEditor = (detail: Race, onValidated = vi.fn()) => render(
  <ToastProvider>
    <QualifyingGridEditor race={race} raceDetail={detail} drivers={[nor, lec, ver]} onValidated={onValidated} />
  </ToastProvider>,
);

describe('QualifyingGridEditor', () => {
  beforeEach(() => vi.mocked(enterQualifyingResults).mockReset());

  it('affiche le brouillon jolpica et valide la grille dans son ordre, absents exclus', async () => {
    const detail: Race = {
      ...race,
      qualifyingDraft: true,
      qualifyingResults: [
        { driver: lec, position: 1, time: '1:24.083' },
        { driver: nor, position: 2, time: null },
      ],
    };
    vi.mocked(enterQualifyingResults).mockResolvedValue({ ...detail, qualifyingDraft: false });
    const onValidated = vi.fn();
    renderEditor(detail, onValidated);

    expect(screen.getByText(/pas encore validée/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Valider la grille/ }));

    await waitFor(() => expect(enterQualifyingResults).toHaveBeenCalledWith(10, [
      { driverId: 2, position: 1, time: '1:24.083' },
      { driverId: 1, position: 2, time: null },
    ]));
    expect(onValidated).toHaveBeenCalled();
  });

  it('sans grille importée, propose la saisie manuelle depuis le roster complet', async () => {
    vi.mocked(enterQualifyingResults).mockResolvedValue(race);
    renderEditor({ ...race, qualifyingResults: [] });

    expect(screen.getByText(/jolpica en retard/)).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('checkbox')[2]);   // VER absent
    await userEvent.click(screen.getByRole('button', { name: /Valider la grille/ }));

    await waitFor(() => expect(enterQualifyingResults).toHaveBeenCalledWith(10, [
      { driverId: 1, position: 1, time: null },
      { driverId: 2, position: 2, time: null },
    ]));
  });
});
