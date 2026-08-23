import { useEffect, useState, useMemo } from 'react';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import type { Match } from '@/types';
import MatchCard from '@/components/MatchCard';
import MatchRow from '@/components/MatchRow';
import BracketView from '@/components/BracketView';
import NoGroupBanner from '@/components/NoGroupBanner';
import CompetitionFilterPills from '@/components/CompetitionFilterPills';
import Pagination from '@/components/Pagination';
import { useMatches } from '@/context/MatchesContext';
import { formatDate } from '@/utils/dates';
import { isUpcomingStatus } from '@/utils/matchStatus';

type FilterStatus = 'ALL' | 'UPCOMING' | 'FINISHED';
type ViewMode = 'grid' | 'list' | 'bracket';

const PAGE_SIZE = 30;

const Matches: React.FC = () => {
  const { matches, hasGroups, isLoading, fetchIfNeeded } = useMatches();
  const [filter, setFilter] = useState<FilterStatus>('UPCOMING');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [search, setSearch] = useState('');
  const [selectedCompetitions, setSelectedCompetitions] = useState<Set<number> | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useScrollRestoration('matches-scroll-y', !isLoading);

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    fetchIfNeeded();
  }, [fetchIfNeeded]);

  const filtered = useMemo(() => {
    if (!hasGroups) return [];
    const q = search.trim().toLowerCase();
    const result = matches.filter((m) => {
      if (filter === 'UPCOMING' && !isUpcomingStatus(m.status)) return false;
      if (filter === 'FINISHED' && m.status !== 'FINISHED') return false;
      if (selectedCompetitions && !selectedCompetitions.has(m.competition.id)) return false;
      if (!q) return true;
      return m.teamA.name.toLowerCase().includes(q) || m.teamB.name.toLowerCase().includes(q);
    });
    // Trié ici, avant la pagination : "À venir" du plus proche au plus lointain,
    // "Terminés"/"Tous" du plus récent au plus ancien par jour — sinon la
    // pagination découperait un ordre non trié et l'inversion par jour n'aurait
    // plus de sens. L'ordre chronologique est conservé au sein d'une même journée.
    return result.sort((a, b) => {
      const dayA = a.matchDate.slice(0, 10);
      const dayB = b.matchDate.slice(0, 10);
      const dayCompare = filter === 'UPCOMING' ? dayA.localeCompare(dayB) : dayB.localeCompare(dayA);
      return dayCompare !== 0 ? dayCompare : a.matchDate.localeCompare(b.matchDate);
    });
  }, [matches, filter, hasGroups, search, selectedCompetitions]);

  // Vue bracket : respecte le filtre compétition mais pas le statut (l'arbre a besoin
  // des matchs joués ET à venir pour reconstruire les tours).
  const bracketMatches = useMemo(() => {
    if (!hasGroups) return [];
    if (!selectedCompetitions) return matches;
    return matches.filter((m) => selectedCompetitions.has(m.competition.id));
  }, [matches, hasGroups, selectedCompetitions]);

  const hasKnockoutInSelection = useMemo(
    () => bracketMatches.some((m) => m.phase === 'KNOCKOUT'),
    [bracketMatches]
  );

  useEffect(() => {
    if (viewMode === 'bracket' && !hasKnockoutInSelection) setViewMode('grid');
  }, [viewMode, hasKnockoutInSelection]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, search, selectedCompetitions]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const filters: { label: string; value: FilterStatus }[] = [
    { label: '📅 À venir', value: 'UPCOMING' },
    { label: '✅ Terminés', value: 'FINISHED' },
    { label: '🌍 Tous', value: 'ALL' },
  ];

  const matchesByDay = paginated.reduce<Record<string, Match[]>>((acc, match) => {
    const day = match.matchDate.slice(0, 10);
    if (!acc[day]) acc[day] = [];
    acc[day].push(match);
    return acc;
  }, {});

  const sortedDays = Object.keys(matchesByDay).sort(
    filter === 'UPCOMING' ? undefined : (a, b) => b.localeCompare(a)
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title mb-0">⚽ Matchs</h1>
      </div>

      {/* No-group alert */}
      {!isLoading && !hasGroups && <NoGroupBanner />}

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
        <CompetitionFilterPills sport="FOOT" selected={selectedCompetitions ?? new Set()} onChange={setSelectedCompetitions} />
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1 min-w-0">
            {viewMode !== 'bracket' && filters.map((f) => (
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
            <button
              onClick={() => hasKnockoutInSelection && setViewMode('bracket')}
              disabled={!hasKnockoutInSelection}
              title={hasKnockoutInSelection ? 'Vue tableau final' : 'Aucune phase finale dans la sélection actuelle'}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'bracket'
                  ? 'bg-white dark:bg-gray-600 shadow text-wc-green'
                  : hasKnockoutInSelection
                    ? 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h4v4H4V5zm0 10h4v4H4v-4zM8 7h4m0 0h4v4h-4V7zm0 0v10m0 0h4m-4-5h4m4-5v10" />
              </svg>
            </button>
          </div>
        </div>
        </div>
      )}

      {/* Vue bracket — un arbre par compétition sélectionnée, ignore le groupement par
          jour et le filtre de statut (garde matchs joués + à venir pour reconstruire l'arbre) */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="text-5xl animate-bounce-slow">⚽</div>
          <p className="text-gray-500 mt-3">Chargement...</p>
        </div>
      ) : hasGroups && viewMode === 'bracket' ? (
        <BracketView matches={bracketMatches} highlight={search} />
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
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
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
