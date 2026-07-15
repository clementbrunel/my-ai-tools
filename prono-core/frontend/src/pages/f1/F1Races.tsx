import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getRaces } from '@/api/f1';
import type { Race } from '@/types';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import { formatDate, formatTime } from '@/utils/dates';
import { getFlagUrl } from '@/utils/countryFlags';

type FilterStatus = 'ALL' | 'UPCOMING' | 'FINISHED';
type ViewMode = 'grid' | 'list';
type PronoStatus = 'done' | 'missing' | undefined;

const pronoStatusOf = (race: Race): PronoStatus => {
  if (race.userPredicted) return 'done';
  if (race.status === 'UPCOMING' && race.openInUserGroups && new Date(race.raceDate) > new Date()) {
    return 'missing';
  }
  return undefined;
};

const borderClassOf = (pronoStatus: PronoStatus) =>
  pronoStatus === 'done'
    ? 'border-l-emerald-400 dark:border-l-emerald-600'
    : pronoStatus === 'missing'
      ? 'border-l-amber-400 dark:border-l-amber-600'
      : 'border-l-transparent';

const RaceFlag: React.FC<{ race: Race; className?: string }> = ({ race, className }) => {
  const url = getFlagUrl(race.countryIso2?.toLowerCase());
  return url
    ? <img src={url} alt={race.countryIso2 ?? ''} className={className ?? 'w-5 h-4 object-contain rounded-sm shadow-sm'} />
    : <span>🏁</span>;
};

const SprintBadge: React.FC = () => (
  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 uppercase">
    Sprint
  </span>
);

/** Grid tile — same visual grammar as MatchCard (left border = prono status). */
const RaceCard: React.FC<{ race: Race }> = ({ race }) => {
  const pronoStatus = pronoStatusOf(race);
  return (
    <Link to={`/f1/races/${race.id}`}>
      <div className={`card border-l-4 ${borderClassOf(pronoStatus)} flex items-center gap-4 hover:shadow-lg cursor-pointer`}>
        <div className="flex flex-col items-center w-12 shrink-0 gap-1">
          <span className="text-[10px] font-bold text-gray-400 uppercase">R{race.round}</span>
          <RaceFlag race={race} className="w-8 h-6 object-cover rounded shadow" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-gray-900 dark:text-white truncate flex items-center gap-2">
            {race.name}
            {race.sprintDate && <SprintBadge />}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{race.circuit}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Qualifs {formatDate(race.qualifyingDate)} {formatTime(race.qualifyingDate)} · Course{' '}
            {formatTime(race.raceDate)}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {race.status === 'FINISHED' ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase">
              Terminé
            </span>
          ) : pronoStatus === 'done' ? (
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">✓ Saisi</span>
          ) : pronoStatus === 'missing' ? (
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">⏰ À saisir</span>
          ) : (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 uppercase">
              {new Date(race.raceDate) <= new Date() ? 'En course' : 'Non ouvert'}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
};

/** List row — mirrors MatchRow: name | center info | date | prono status. */
const RaceRow: React.FC<{ race: Race }> = ({ race }) => {
  const pronoStatus = pronoStatusOf(race);
  return (
    <Link to={`/f1/races/${race.id}`}>
      <div className={`flex items-center gap-3 px-4 py-3 border-l-4 ${borderClassOf(pronoStatus)} bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer`}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <RaceFlag race={race} />
          <span className="font-medium text-sm text-gray-900 dark:text-white truncate">{race.name}</span>
          {race.sprintDate && <span className="hidden sm:inline-flex"><SprintBadge /></span>}
        </div>

        <div className="w-16 flex justify-center shrink-0">
          {race.status === 'FINISHED' ? (
            <span className="text-sm font-bold text-gray-800 dark:text-gray-200">🏁</span>
          ) : (
            <div className="text-center">
              <div className="text-xs font-bold text-gray-400 dark:text-gray-500">R{race.round}</div>
              <div className="text-xs text-gray-400 dark:text-gray-500">{formatTime(race.raceDate)}</div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
          <span className="font-medium text-sm text-gray-500 dark:text-gray-400 truncate text-right hidden sm:inline">
            {race.circuit}
          </span>
        </div>

        <div className="hidden sm:block text-xs text-gray-400 dark:text-gray-500 w-24 text-right shrink-0">
          {formatDate(race.raceDate)}
        </div>

        <div className="hidden sm:block w-20 text-right shrink-0">
          {pronoStatus === 'done' && (
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">✓ Saisi</span>
          )}
          {pronoStatus === 'missing' && (
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">⏰ À saisir</span>
          )}
        </div>
      </div>
    </Link>
  );
};

const monthLabel = (monthKey: string): string => {
  const label = new Date(`${monthKey}-01T00:00:00`).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const F1Races: React.FC = () => {
  const [races, setRaces] = useState<Race[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>('UPCOMING');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [search, setSearch] = useState('');

  useScrollRestoration('f1-races-scroll-y', !isLoading);

  const thisMonth = new Date().toISOString().slice(0, 7);

  useEffect(() => {
    getRaces()
      .then(setRaces)
      .catch(() => setError('Impossible de charger le calendrier'))
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return races.filter((race) => {
      if (filter !== 'ALL' && race.status !== filter) return false;
      if (!q) return true;
      return (
        race.name.toLowerCase().includes(q) ||
        (race.circuit ?? '').toLowerCase().includes(q)
      );
    });
  }, [races, filter, search]);

  const filters: { label: string; value: FilterStatus }[] = [
    { label: '📅 À venir', value: 'UPCOMING' },
    { label: '✅ Terminés', value: 'FINISHED' },
    { label: '🌍 Tous', value: 'ALL' },
  ];

  const racesByMonth = filtered.reduce<Record<string, Race[]>>((acc, race) => {
    const month = race.raceDate.slice(0, 7);
    if (!acc[month]) acc[month] = [];
    acc[month].push(race);
    return acc;
  }, {});

  const sortedMonths = Object.keys(racesByMonth).sort(
    filter === 'FINISHED' ? (a, b) => b.localeCompare(a) : undefined,
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title mb-0">🏎 Grands Prix</h1>
      </div>

      {/* Filters + view toggle — same layout as the football matches page */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="relative">
          <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none">🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un Grand Prix ou un circuit…"
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

      {error && (
        <div className="card bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 mb-6">{error}</div>
      )}

      {/* Races grouped by month */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="text-5xl animate-bounce-slow">🏎</div>
          <p className="text-gray-500 mt-3">Chargement...</p>
        </div>
      ) : sortedMonths.length > 0 ? (
        <div className="space-y-8">
          {sortedMonths.map((month) => {
            const isThisMonth = month === thisMonth;
            return (
              <section key={month}>
                <div className="flex items-center gap-3 mb-4">
                  <h2
                    className={`text-lg font-bold ${
                      isThisMonth
                        ? 'text-wc-green dark:text-green-400'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    📅 {monthLabel(month)}
                  </h2>
                  {isThisMonth && (
                    <span className="text-xs font-semibold bg-wc-green text-white px-2 py-0.5 rounded-full">
                      Ce mois-ci
                    </span>
                  )}
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {racesByMonth[month].length} course{racesByMonth[month].length > 1 ? 's' : ''}
                  </span>
                </div>

                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {racesByMonth[month].map((race) => (
                      <RaceCard key={race.id} race={race} />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {racesByMonth[month].map((race) => (
                      <RaceRow key={race.id} race={race} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="card text-center py-12 text-gray-500 dark:text-gray-400">
          <div className="text-4xl mb-3">😅</div>
          <p>Aucune course dans cette catégorie</p>
        </div>
      )}
    </div>
  );
};

export default F1Races;
