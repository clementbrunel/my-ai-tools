import { useEffect, useMemo, useState } from 'react';
import { getMyGroups } from '../api/groups';
import { getMatches } from '../api/matches';
import { getBets, openMatchForBetting, openCompetitionForBetting, closeMatchForBetting } from '../api/bets';
import { getCompetitions } from '../api/competitions';
import type { Group, Match, MatchPhase } from '../types';
import { formatDate } from '../utils/dates';
import ConfirmModal from '../components/ConfirmModal';
import { useGroupAdminCounts } from '../context/GroupAdminCountsContext';

type StatusFilter = 'CLOSED' | 'OPEN';

/**
 * Group-admin view to open matches for betting in a group.
 * Matches are grouped by competition so a whole competition can be opened
 * in a single action — minimising the number of admin clicks.
 */
const OpenBetting: React.FC = () => {
  const { clearMatchesWithoutBetsAlert } = useGroupAdminCounts();

  useEffect(() => {
    clearMatchesWithoutBetsAlert();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [adminGroups, setAdminGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [openMatchIds, setOpenMatchIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [matchToClose, setMatchToClose] = useState<Match | null>(null);
  const [allCompetitions, setAllCompetitions] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('CLOSED');
  const [competitionFilter, setCompetitionFilter] = useState('');
  const [phaseFilter, setPhaseFilter] = useState<MatchPhase | ''>('');

  // Load the groups the user administers
  useEffect(() => {
    getMyGroups()
      .then((groups) => {
        const admin = groups.filter((g) => g.currentUserRole === 'GROUP_ADMIN');
        setAdminGroups(admin);
        if (admin.length > 0) setSelectedGroupId(admin[0].id);
      })
      .catch(() => setError('Impossible de charger vos groupes'))
      .finally(() => setIsLoading(false));
  }, []);

  // Load the full list of registered competitions for the filter dropdown
  useEffect(() => {
    getCompetitions()
      .then(setAllCompetitions)
      .catch(() => setError('Impossible de charger les compétitions'));
  }, []);

  // Load matches + which ones are already open in the selected group
  useEffect(() => {
    if (selectedGroupId == null) return;
    setError(null);
    Promise.all([getMatches(), getBets()])
      .then(([allMatches, bets]) => {
        setMatches(allMatches);
        setOpenMatchIds(
          new Set(
            bets
              .filter((b) => b.groupId === selectedGroupId && b.match)
              .map((b) => b.match!.id)
          )
        );
      })
      .catch(() => setError('Impossible de charger les matchs'));
  }, [selectedGroupId]);

  const filteredMatches = useMemo(() => {
    return matches.filter((match) => {
      const isOpen = openMatchIds.has(match.id);
      if (statusFilter === 'OPEN' && !isOpen) return false;
      if (statusFilter === 'CLOSED' && isOpen) return false;
      if (competitionFilter && match.competition !== competitionFilter) return false;
      if (phaseFilter && match.phase !== phaseFilter) return false;
      return true;
    });
  }, [matches, openMatchIds, statusFilter, competitionFilter, phaseFilter]);

  // Group matches by competition, preserving date order within each competition
  const matchesByCompetition = useMemo(() => {
    return filteredMatches.reduce<Record<string, Match[]>>((acc, match) => {
      (acc[match.competition] ??= []).push(match);
      return acc;
    }, {});
  }, [filteredMatches]);

  const competitions = Object.keys(matchesByCompetition).sort();

  const handleOpenMatch = async (matchId: number) => {
    if (selectedGroupId == null) return;
    setBusy(`match-${matchId}`);
    setError(null);
    try {
      await openMatchForBetting({ groupId: selectedGroupId, matchId });
      setOpenMatchIds((prev) => new Set(prev).add(matchId));
    } catch {
      setError("Erreur lors de l'ouverture du match");
    } finally {
      setBusy(null);
    }
  };

  const handleCloseMatch = async () => {
    if (selectedGroupId == null || matchToClose == null) return;
    setBusy(`match-close-${matchToClose.id}`);
    setError(null);
    setMatchToClose(null);
    try {
      await closeMatchForBetting(selectedGroupId, matchToClose.id);
      setOpenMatchIds((prev) => {
        const next = new Set(prev);
        next.delete(matchToClose.id);
        return next;
      });
    } catch {
      setError('Erreur lors de la fermeture du match');
    } finally {
      setBusy(null);
    }
  };

  const handleOpenCompetition = async (competition: string) => {
    if (selectedGroupId == null) return;
    setBusy(`comp-${competition}`);
    setError(null);
    try {
      const created = await openCompetitionForBetting({ groupId: selectedGroupId, competition });
      setOpenMatchIds((prev) => {
        const next = new Set(prev);
        created.forEach((b) => b.match && next.add(b.match.id));
        return next;
      });
    } catch {
      setError("Erreur lors de l'ouverture de la compétition");
    } finally {
      setBusy(null);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl animate-bounce-slow">🎲</div>
        <p className="text-gray-500 mt-3">Chargement...</p>
      </div>
    );
  }

  if (adminGroups.length === 0) {
    return (
      <div className="card text-center py-10">
        <div className="text-4xl mb-3">🔒</div>
        <p className="text-gray-500">Vous n'êtes administrateur d'aucun groupe.</p>
        <p className="text-gray-400 text-sm mt-1">
          Seuls les admins de groupe peuvent ouvrir des matchs aux paris.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title mb-0">🎲 Ouvrir des matchs aux paris</h1>
        <div className="flex items-center gap-2">
          <label className="label mb-0">Groupe</label>
          <select
            value={selectedGroupId ?? ''}
            onChange={(e) => setSelectedGroupId(Number(e.target.value))}
            className="input-field"
          >
            {adminGroups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="label mb-0">Statut</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="input-field"
          >
            <option value="CLOSED">Fermés</option>
            <option value="OPEN">Ouverts</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="label mb-0">Compétition</label>
          <select
            value={competitionFilter}
            onChange={(e) => setCompetitionFilter(e.target.value)}
            className="input-field"
          >
            <option value="">Toutes</option>
            {allCompetitions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="label mb-0">Phase</label>
          <select
            value={phaseFilter}
            onChange={(e) => setPhaseFilter(e.target.value as MatchPhase | '')}
            className="input-field"
          >
            <option value="">Toutes</option>
            <option value="POOL">Phase de poules</option>
            <option value="KNOCKOUT">Phase éliminatoire</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-red-700 dark:text-red-400 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-bold">✕</button>
        </div>
      )}

      {competitions.length === 0 ? (
        <div className="card text-center py-10 text-gray-500">Aucun match ne correspond aux filtres.</div>
      ) : (
        <div className="space-y-8">
          {competitions.map((competition) => {
            const compMatches = matchesByCompetition[competition];
            const openCount = compMatches.filter((m) => openMatchIds.has(m.id)).length;
            const allOpen = openCount === compMatches.length;
            return (
              <section key={competition}>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-gray-700 dark:text-gray-300">🏆 {competition}</h2>
                    <span className="text-xs text-gray-400">
                      {openCount}/{compMatches.length} ouvert{openCount > 1 ? 's' : ''}
                    </span>
                  </div>
                  <button
                    onClick={() => handleOpenCompetition(competition)}
                    disabled={allOpen || busy === `comp-${competition}`}
                    className="btn-primary text-sm disabled:opacity-50"
                  >
                    {allOpen
                      ? '✅ Tout est ouvert'
                      : busy === `comp-${competition}`
                        ? 'Ouverture...'
                        : '🚀 Ouvrir toute la compétition'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {compMatches.map((match) => {
                    const isOpen = openMatchIds.has(match.id);
                    return (
                      <div
                        key={match.id}
                        className="card flex items-center justify-between gap-3 py-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {match.teamA} vs {match.teamB}
                          </p>
                          <p className="text-xs text-gray-400">{formatDate(match.matchDate)}</p>
                        </div>
                        {isOpen ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded font-medium whitespace-nowrap">
                              ✓ Ouvert
                            </span>
                            <button
                              onClick={() => setMatchToClose(match)}
                              disabled={busy === `match-close-${match.id}`}
                              className="btn-danger text-xs whitespace-nowrap disabled:opacity-50"
                            >
                              {busy === `match-close-${match.id}` ? '...' : 'Fermer'}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleOpenMatch(match.id)}
                            disabled={busy === `match-${match.id}`}
                            className="btn-secondary text-xs whitespace-nowrap disabled:opacity-50"
                          >
                            {busy === `match-${match.id}` ? '...' : 'Ouvrir'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <ConfirmModal
        isOpen={matchToClose != null}
        title="Fermer ce match aux paris ?"
        message={`Cela supprimera définitivement le pari et tous les pronostics déjà enregistrés pour "${matchToClose?.teamA} vs ${matchToClose?.teamB}". Cette action est irréversible.`}
        confirmLabel="Fermer le match"
        variant="danger"
        onConfirm={handleCloseMatch}
        onCancel={() => setMatchToClose(null)}
      />
    </div>
  );
};

export default OpenBetting;
