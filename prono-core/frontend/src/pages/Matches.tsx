import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigationType } from 'react-router-dom';
import { getMatchesForMyGroups } from '../api/matches';
import { getMyGroups } from '../api/groups';
import type { Match } from '../types';
import { isAdmin } from '../types';
import MatchCard from '../components/MatchCard';
import MatchRow from '../components/MatchRow';
import { useAuth } from '../context/AuthContext';

import { formatDate } from '../utils/dates';

type FilterStatus = 'ALL' | 'UPCOMING' | 'FINISHED';
type ViewMode = 'grid' | 'list';

const SCROLL_KEY = 'matches-scroll-y';

const Matches: React.FC = () => {
  const { user } = useAuth();
  const navigationType = useNavigationType();
  const [matches, setMatches] = useState<Match[]>([]);
  const [filter, setFilter] = useState<FilterStatus>('UPCOMING');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [isLoading, setIsLoading] = useState(true);
  const [hasGroups, setHasGroups] = useState(true);
  const [search, setSearch] = useState('');

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [groups, matchesData] = await Promise.all([getMyGroups(), getMatchesForMyGroups()]);
        setHasGroups(groups.length > 0);
        setMatches(matchesData);
      } catch (err) {
        console.error('Error loading data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // Save scroll position continuously while on this page
  useEffect(() => {
    const handleScroll = () => {
      sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Restore scroll position when navigating back, after data is loaded
  useEffect(() => {
    if (navigationType === 'POP' && !isLoading) {
      const saved = sessionStorage.getItem(SCROLL_KEY);
      if (saved) {
        requestAnimationFrame(() => {
          window.scrollTo(0, parseInt(saved, 10));
        });
      }
    }
  }, [navigationType, isLoading]);

  const filtered = useMemo(() => {
    if (!hasGroups) return [];
    const q = search.trim().toLowerCase();
    return matches.filter((m) => {
      if (filter !== 'ALL' && m.status !== filter) return false;
      if (!q) return true;
      return m.teamA.toLowerCase().includes(q) || m.teamB.toLowerCase().includes(q);
    });
  }, [matches, filter, hasGroups, search]);

  const filters: { label: string; value: FilterStatus }[] = [
    { label: '📅 À venir', value: 'UPCOMING' },
    { label: '✅ Terminés', value: 'FINISHED' },
    { label: '🌍 Tous', value: 'ALL' },
  ];

  const matchesByDay = filtered.reduce<Record<string, Match[]>>((acc, match) => {
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

      {/* Filters + view toggle — hidden when no group */}
      {hasGroups && (
        <div className="flex flex-col gap-3 mb-6">
        <div className="relative">
          <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none">🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une équipe…"
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-wc-green"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              ✕
            </button>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1 min-w-0">
            {filters.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                  filter === f.value
                    ? 'bg-wc-green text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* View mode toggle */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1 shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              title="Vue tuiles"
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-gray-600 shadow text-wc-green'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('list')}
              title="Vue liste"
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-gray-600 shadow text-wc-green'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </div>
        </div>
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

                {/* Cards / rows for this day */}
                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {matchesByDay[day].map((match) => {
                      const pronoStatus =
                        match.userParticipated
                          ? 'done'
                          : match.status === 'UPCOMING' && new Date(match.matchDate) > new Date()
                            ? 'missing'
                            : undefined;
                      return <MatchCard key={match.id} match={match} pronoStatus={pronoStatus} />;
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {matchesByDay[day].map((match) => {
                      const pronoStatus =
                        match.userParticipated
                          ? 'done'
                          : match.status === 'UPCOMING' && new Date(match.matchDate) > new Date()
                            ? 'missing'
                            : undefined;
                      return <MatchRow key={match.id} match={match} pronoStatus={pronoStatus} />;
                    })}
                  </div>
                )}
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
