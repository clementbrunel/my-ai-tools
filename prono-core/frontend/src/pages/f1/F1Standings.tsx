import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getConstructorStandings, getDriverStandings } from '../../api/f1';
import type { F1Standing } from '../../types';
import MiniF1Car from '../../components/f1/MiniF1Car';
import PillTabs from '../../components/PillTabs';

type Tab = 'drivers' | 'constructors';

const StandingRow: React.FC<{ standing: F1Standing; isDriver: boolean }> = ({ standing, isDriver }) => {
  const content = (
    <>
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
    </>
  );

  if (isDriver && standing.driver) {
    return (
      <Link to={`/f1/drivers/${standing.driver.id}`} className="flex items-center gap-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 -mx-2 px-2 rounded-lg transition-colors">
        {content}
      </Link>
    );
  }
  return <div className="flex items-center gap-3 py-2">{content}</div>;
};

const F1Standings: React.FC = () => {
  const [tab, setTab] = useState<Tab>('drivers');
  const [drivers, setDrivers] = useState<F1Standing[]>([]);
  const [constructors, setConstructors] = useState<F1Standing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getDriverStandings(), getConstructorStandings()])
      .then(([driverRows, constructorRows]) => {
        setDrivers(driverRows);
        setConstructors(constructorRows);
      })
      .catch(() => setError('Impossible de charger les classements'))
      .finally(() => setIsLoading(false));
  }, []);

  const rows = tab === 'drivers' ? drivers : constructors;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="page-title mb-0">📊 Championnat</h1>
        <PillTabs
          options={[
            ['drivers', '🏎 Pilotes'],
            ['constructors', '🔧 Constructeurs'],
          ]}
          value={tab}
          onChange={setTab}
        />
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
