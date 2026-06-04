import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMatches } from '../api/matches';
import type { Match } from '../types';
import { isAdmin } from '../types';
import MatchCard from '../components/MatchCard';
import { useAuth } from '../context/AuthContext';

import { formatDate } from '../utils/dates';

type FilterStatus = 'ALL' | 'UPCOMING' | 'FINISHED';

const Matches: React.FC = () => {
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [filter, setFilter] = useState<FilterStatus>('ALL');
  const [isLoading, setIsLoading] = useState(true);

  const today = new Date().toISOString().slice(0, 10); // "2026-06-11"

  useEffect(() => {
    const fetchMatches = async () => {
      setIsLoading(true);
      try {
        const data = await getMatches(filter !== 'ALL' ? filter : undefined);
        setMatches(data);
      } catch (err) {
        console.error('Error loading matches:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMatches();
  }, [filter]);

  const filters: { label: string; value: FilterStatus }[] = [
    { label: '🌍 Tous', value: 'ALL' },
    { label: '📅 À venir', value: 'UPCOMING' },
    { label: '✅ Terminés', value: 'FINISHED' },
  ];

  // Group matches by calendar day (YYYY-MM-DD), preserving API sort order within each day
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

      {/* Filters */}
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

      {/* Matches grouped by day */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="text-5xl animate-bounce-slow">⚽</div>
          <p className="text-gray-500 mt-3">Chargement...</p>
        </div>
      ) : sortedDays.length > 0 ? (
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
                  {matchesByDay[day].map((match) => (
                    <MatchCard key={match.id} match={match} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="card text-center py-12 text-gray-500 dark:text-gray-400">
          <div className="text-4xl mb-3">😅</div>
          <p>Aucun match trouvé</p>
        </div>
      )}
    </div>
  );
};

export default Matches;
