import { useEffect, useMemo, useState } from 'react';
import { getMyGroups } from '../api/groups';
import { getMatches } from '../api/matches';
import { getBets, openMatchForBetting, openCompetitionForBetting } from '../api/bets';
import type { Group, Match } from '../types';
import { formatDate } from '../utils/dates';

/**
 * Group-admin view to open matches for betting in a group.
 * Matches are grouped by competition so a whole competition can be opened
 * in a single action — minimising the number of admin clicks.
 */
const OpenBetting: React.FC = () => {
  const [adminGroups, setAdminGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [openMatchIds, setOpenMatchIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  // Group matches by competition, preserving date order within each competition
  const matchesByCompetition = useMemo(() => {
    return matches.reduce<Record<string, Match[]>>((acc, match) => {
      (acc[match.competition] ??= []).push(match);
      return acc;
    }, {});
  }, [matches]);

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

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-red-700 dark:text-red-400 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-bold">✕</button>
        </div>
      )}

      {competitions.length === 0 ? (
        <div className="card text-center py-10 text-gray-500">Aucun match disponible.</div>
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
                          <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded font-medium whitespace-nowrap">
                            ✓ Ouvert
                          </span>
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
    </div>
  );
};

export default OpenBetting;
