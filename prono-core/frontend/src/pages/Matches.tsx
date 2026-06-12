import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getBets } from '../api/bets';
import { getMyGroups } from '../api/groups';
import type { Bet, Match } from '../types';
import { isAdmin } from '../types';
import MatchCard from '../components/MatchCard';
import { useAuth } from '../context/AuthContext';

import { formatDate } from '../utils/dates';

type FilterStatus = 'ALL' | 'UPCOMING' | 'FINISHED';

const Matches: React.FC = () => {
  const { user } = useAuth();
  const [bets, setBets] = useState<Bet[]>([]);
  const [filter, setFilter] = useState<FilterStatus>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [hasGroups, setHasGroups] = useState(true);

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [groups, betsData] = await Promise.all([getMyGroups(), getBets()]);
        setHasGroups(groups.length > 0);
        setBets(betsData);
      } catch (err) {
        console.error('Error loading data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const matches = useMemo(() => {
    if (!hasGroups) return [];
    const seen = new Set<number>();
    const unique: Match[] = [];
    for (const bet of bets) {
      if (bet.match && !seen.has(bet.match.id)) {
        seen.add(bet.match.id);
        unique.push(bet.match);
      }
    }
    const filtered = filter === 'ALL' ? unique : unique.filter((m) => m.status === filter);
    return filtered.sort((a, b) => a.matchDate.localeCompare(b.matchDate));
  }, [bets, filter, hasGroups]);

  const participatedMatchIds = useMemo(() => {
    const ids = new Set<number>();
    for (const bet of bets) {
      if (bet.match && bet.userParticipated) ids.add(bet.match.id);
    }
    return ids;
  }, [bets]);

  const filters: { label: string; value: FilterStatus }[] = [
    { label: '🌍 Tous', value: 'ALL' },
    { label: '📅 À venir', value: 'UPCOMING' },
    { label: '✅ Terminés', value: 'FINISHED' },
  ];

  const matchesByDay = matches.reduce<Record<string, Match[]>>((acc, match) => {
    const day = match.matchDate.slice(0, 10);
    if (!acc[day]) acc[day] = [];
    acc[day].push(match);
    return acc;
  }, {});

  const sortedDays = Object.keys(matchesByDay).sort();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title mb-0">⚽ Matchs</h1>
        {isAdmin(user) && (
          <Link to="/admin" className="btn-primary text-sm">
            + Nouveau match
          </Link>
        )}
      </div>

      {/* No-group alert */}
      {!isLoading && !hasGroups && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/30 px-4 py-3 text-amber-800 dark:text-amber-300">
          <span className="text-xl mt-0.5">⚠️</span>
          <div className="text-sm leading-snug">
            <p className="font-semibold mb-1">Tu n'es membre d'aucun groupe</p>
            <p>
              Rejoins ou crée un groupe pour accéder aux paris.{' '}
              <Link to="/groups" className="underline font-medium hover:opacity-80">
                Gérer mes groupes →
              </Link>
            </p>
          </div>
        </div>
      )}

      {/* Filters — hidden when no group */}
      {hasGroups && (
        <div className="flex flex-wrap gap-2 mb-6">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                filter === f.value
                  ? 'bg-wc-green text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Matches grouped by day */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="text-5xl animate-bounce-slow">⚽</div>
          <p className="text-gray-500 mt-3">Chargement...</p>
        </div>
      ) : hasGroups && sortedDays.length > 0 ? (
        <div className="space-y-8">
          {sortedDays.map((day) => {
            const isToday = day === today;
            return (
              <section key={day}>
                {/* Day header */}
                <div className="flex items-center gap-3 mb-4">
                  <h2
                    className={`text-lg font-bold ${
                      isToday
                        ? 'text-wc-green dark:text-green-400'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    📅 {formatDate(day)}
                  </h2>
                  {isToday && (
                    <span className="text-xs font-semibold bg-wc-green text-white px-2 py-0.5 rounded-full">
                      Aujourd'hui
                    </span>
                  )}
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {matchesByDay[day].length} match{matchesByDay[day].length > 1 ? 's' : ''}
                  </span>
                </div>

                {/* Cards for this day */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {matchesByDay[day].map((match) => {
                    const pronoStatus =
                      participatedMatchIds.has(match.id)
                        ? 'done'
                        : match.status === 'UPCOMING'
                          ? 'missing'
                          : undefined;
                    return <MatchCard key={match.id} match={match} pronoStatus={pronoStatus} />;
                  })}
                </div>
              </section>
            );
          })}
        </div>
      ) : hasGroups ? (
        <div className="card text-center py-12 text-gray-500 dark:text-gray-400">
          <div className="text-4xl mb-3">😅</div>
          <p>Aucun match disponible dans tes groupes</p>
        </div>
      ) : null}
    </div>
  );
};

export default Matches;
