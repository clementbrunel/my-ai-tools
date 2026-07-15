import { useEffect, useState } from 'react';
import {
  getConstructorStandings,
  getConstructorStandingsHistory,
  getDriverStandings,
  getDriverStandingsHistory,
} from '../../api/f1';
import type { F1Standing, F1StandingHistory } from '../../types';
import MiniF1Car from '../../components/f1/MiniF1Car';
import StandingsChart from '../../components/f1/StandingsChart';
import PillTabs from '../../components/PillTabs';

type Tab = 'drivers' | 'constructors';
type ViewMode = 'list' | 'chart';

const StandingRow: React.FC<{ standing: F1Standing; isDriver: boolean }> = ({ standing, isDriver }) => (
  <div className="flex items-center gap-3 py-2">
    <span className={`w-8 text-right font-black ${standing.rank <= 3 ? 'text-wc-gold' : 'text-gray-400'}`}>
      {standing.rank}
    </span>
    <span className="w-1.5 h-7 rounded" style={{ backgroundColor: standing.constructorColor }} />
    <div className="flex-1 min-w-0">
      <div className="font-bold text-gray-900 dark:text-white truncate">
        {isDriver && standing.driver ? standing.driver.name : standing.constructorName}
      </div>
      <div className="text-xs text-gray-400">
        {isDriver && standing.driver
          ? `${standing.constructorName} · #${standing.driver.number}`
          : `${standing.wins} victoire${standing.wins > 1 ? 's' : ''} · ${standing.podiums} podium${standing.podiums > 1 ? 's' : ''}`}
      </div>
    </div>
    {isDriver && standing.driver && (
      <MiniF1Car color={standing.constructorColor} size={36} className="hidden sm:block" />
    )}
    <div className="text-right">
      <div className="font-black text-lg text-gray-900 dark:text-white">{standing.points}</div>
      <div className="text-[10px] uppercase text-gray-400">pts</div>
    </div>
  </div>
);

const F1Standings: React.FC = () => {
  const [tab, setTab] = useState<Tab>('drivers');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [drivers, setDrivers] = useState<F1Standing[]>([]);
  const [constructors, setConstructors] = useState<F1Standing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [history, setHistory] = useState<Record<Tab, F1StandingHistory | null>>({
    drivers: null,
    constructors: null,
  });
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  useEffect(() => {
    Promise.all([getDriverStandings(), getConstructorStandings()])
      .then(([driverRows, constructorRows]) => {
        setDrivers(driverRows);
        setConstructors(constructorRows);
      })
      .catch(() => setError('Impossible de charger les classements'))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (viewMode !== 'chart' || history[tab]) return;
    setIsHistoryLoading(true);
    const fetchHistory = tab === 'drivers' ? getDriverStandingsHistory : getConstructorStandingsHistory;
    fetchHistory()
      .then((data) => setHistory((prev) => ({ ...prev, [tab]: data })))
      .catch(() => setError('Impossible de charger le graphique'))
      .finally(() => setIsHistoryLoading(false));
  }, [viewMode, tab, history]);

  const rows = tab === 'drivers' ? drivers : constructors;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="page-title mb-0">📊 Championnat</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <PillTabs
            options={[
              ['drivers', '🏎 Pilotes'],
              ['constructors', '🔧 Constructeurs'],
            ]}
            value={tab}
            onChange={setTab}
          />

          {/* View mode toggle — same visual grammar as the races/matches list */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1 shrink-0">
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
              onClick={() => setViewMode('chart')}
              title="Vue graphique"
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'chart'
                  ? 'bg-white dark:bg-gray-600 shadow text-wc-green'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <line x1="4" y1="21" x2="4" y2="14" />
                <line x1="10" y1="21" x2="10" y2="9" />
                <line x1="16" y1="21" x2="16" y2="4" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="card bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300">{error}</div>
      )}

      {isLoading ? (
        <div className="card text-center py-12 text-gray-500">Chargement…</div>
      ) : rows.length === 0 ? (
        <div className="card text-center py-12 space-y-2">
          <div className="text-5xl">🏁</div>
          <p className="text-gray-500 dark:text-gray-400">
            Le classement apparaîtra dès le premier résultat de course saisi.
          </p>
        </div>
      ) : viewMode === 'chart' ? (
        isHistoryLoading || !history[tab] ? (
          <div className="card text-center py-12 text-gray-500">Chargement…</div>
        ) : (
          <>
          <StandingsChart history={history[tab]!} />
          <p className="text-xs text-gray-400 text-center">
            Points cumulés par Grand Prix — top {history[tab]!.series.length} · barème FIA (25…1) et sprints (8…1) inclus.
          </p>
          </>
        )
      ) : (
        <>
        <div className="card divide-y divide-gray-100 dark:divide-gray-800">
          {rows.map((standing) => (
            <StandingRow
              key={tab === 'drivers' ? standing.driver?.id : standing.constructorId}
              standing={standing}
              isDriver={tab === 'drivers'}
            />
          ))}
        </div>
        <p className="text-xs text-gray-400 text-center">
          Barème FIA — courses (25…1) et sprints (8…1) inclus.
        </p>
        </>
      )}
    </div>
  );
};

export default F1Standings;
