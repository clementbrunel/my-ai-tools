import { useEffect, useMemo, useState } from 'react';
import { getMyGroups } from '../../api/groups';
import { getBets } from '../../api/bets';
import { closeRaceForBetting, getRaces, openCompetitionRaces, openRaceForBetting } from '../../api/f1';
import type { Group, Race } from '../../types';
import { formatDate } from '../../utils/dates';
import { useToast } from '../../components/Toast';
import PillTabs from '../../components/PillTabs';

type StatusFilter = 'CLOSED' | 'OPEN';

/**
 * Group-admin view to open F1 races for betting — F1 twin of OpenBetting.
 * Only groups that play F1 can open races (enforced server-side too).
 */
const F1OpenBetting: React.FC = () => {
  const { showToast } = useToast();
  const [adminGroups, setAdminGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [races, setRaces] = useState<Race[]>([]);
  const [openRaceIds, setOpenRaceIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('CLOSED');

  useEffect(() => {
    getMyGroups()
      .then((groups) => {
        const admin = groups.filter((g) => g.currentUserRole === 'GROUP_ADMIN' && g.sports?.includes('F1'));
        setAdminGroups(admin);
        if (admin.length > 0) setSelectedGroupId(admin[0].id);
      })
      .catch(() => setError('Impossible de charger vos groupes'))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (selectedGroupId == null) return;
    setError(null);
    Promise.all([getRaces(), getBets()])
      .then(([rows, bets]) => {
        setRaces(rows);
        setOpenRaceIds(
          new Set(
            bets
              .filter((b) => b.groupId === selectedGroupId && b.raceId != null)
              .map((b) => b.raceId!),
          ),
        );
      })
      .catch(() => setError('Impossible de charger les courses'));
  }, [selectedGroupId]);

  const upcoming = useMemo(() => races.filter((r) => r.status !== 'FINISHED'), [races]);
  const filtered = useMemo(
    () =>
      upcoming.filter((race) =>
        statusFilter === 'OPEN' ? openRaceIds.has(race.id) : !openRaceIds.has(race.id),
      ),
    [upcoming, openRaceIds, statusFilter],
  );

  const handleOpen = async (race: Race) => {
    if (selectedGroupId == null) return;
    setBusy(`open-${race.id}`);
    try {
      await openRaceForBetting(selectedGroupId, race.id);
      setOpenRaceIds((prev) => new Set(prev).add(race.id));
      showToast(`${race.name} ouvert aux pronos ! 🏁`, 'success');
    } catch (e: unknown) {
      const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      showToast(message ?? "Impossible d'ouvrir la course", 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleClose = async (race: Race) => {
    if (selectedGroupId == null) return;
    setBusy(`close-${race.id}`);
    try {
      await closeRaceForBetting(selectedGroupId, race.id);
      setOpenRaceIds((prev) => {
        const next = new Set(prev);
        next.delete(race.id);
        return next;
      });
      showToast(`${race.name} fermé`, 'info');
    } catch {
      showToast('Impossible de fermer la course', 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleOpenAll = async () => {
    if (selectedGroupId == null || upcoming.length === 0) return;
    setBusy('open-all');
    try {
      await openCompetitionRaces(selectedGroupId, upcoming[0].competitionId);
      setOpenRaceIds(new Set(races.map((r) => r.id)));
      showToast('Toute la saison est ouverte aux pronos ! 🏆', 'success');
    } catch (e: unknown) {
      const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      showToast(message ?? "Impossible d'ouvrir la saison", 'error');
    } finally {
      setBusy(null);
    }
  };

  if (isLoading) return <div className="card text-center py-12 text-gray-500">Chargement…</div>;

  if (adminGroups.length === 0) {
    return (
      <div className="card text-center py-12 space-y-2">
        <div className="text-5xl">🏎</div>
        <p className="text-gray-600 dark:text-gray-300 font-semibold">Aucun groupe F1 à administrer</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Active le sport F1 dans les réglages d'un groupe dont tu es admin.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="page-title mb-0">🔓 Ouvrir les Grands Prix</h1>

      {error && <div className="card bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300">{error}</div>}

      <div className="card flex flex-wrap items-center gap-3">
        <select
          className="input-field !w-auto"
          value={selectedGroupId ?? ''}
          onChange={(e) => setSelectedGroupId(Number(e.target.value))}
        >
          {adminGroups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
        <PillTabs
          options={[
            ['CLOSED', 'À ouvrir'],
            ['OPEN', 'Ouverts'],
          ]}
          value={statusFilter}
          onChange={setStatusFilter}
        />
        <button onClick={handleOpenAll} disabled={busy !== null} className="btn-gold ml-auto">
          {busy === 'open-all' ? 'Ouverture…' : '🏆 Ouvrir toute la saison'}
        </button>
      </div>

      <div className="space-y-2">
        {filtered.map((race) => {
          const isOpen = openRaceIds.has(race.id);
          return (
            <div key={race.id} className="card flex items-center gap-3">
              <span className="text-xs font-bold text-gray-400 w-8">R{race.round}</span>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-gray-900 dark:text-white truncate">{race.name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Course le {formatDate(race.raceDate)}</div>
              </div>
              {isOpen ? (
                <button
                  onClick={() => handleClose(race)}
                  disabled={busy !== null}
                  className="btn-secondary !py-1 text-sm"
                >
                  {busy === `close-${race.id}` ? '…' : 'Fermer'}
                </button>
              ) : (
                <button
                  onClick={() => handleOpen(race)}
                  disabled={busy !== null}
                  className="btn-primary !py-1 text-sm"
                >
                  {busy === `open-${race.id}` ? '…' : 'Ouvrir'}
                </button>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="card text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
            {statusFilter === 'CLOSED'
              ? 'Toutes les courses à venir sont déjà ouvertes (ou aucune course à venir).'
              : 'Aucune course ouverte pour ce groupe pour le moment.'}
          </div>
        )}
      </div>
    </div>
  );
};

export default F1OpenBetting;
