import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getDriver, getDriverResults } from '../../api/f1';
import type { Driver, DriverRaceResult } from '../../types';
import { formatDate } from '../../utils/dates';
import { getFlagUrl } from '../../utils/countryFlags';
import MiniF1Car from '../../components/f1/MiniF1Car';

const DriverDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const goBack = () => location.key === 'default' ? navigate('/f1/standings') : navigate(-1);

  const [driver, setDriver] = useState<Driver | null>(null);
  const [results, setResults] = useState<DriverRaceResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        const [driverData, resultsData] = await Promise.all([
          getDriver(parseInt(id)),
          getDriverResults(parseInt(id)),
        ]);
        setDriver(driverData);
        setResults(resultsData);
      } catch {
        setError('Pilote introuvable');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [id]);

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl animate-bounce-slow">🏎</div>
        <p className="text-gray-500 mt-3">Chargement...</p>
      </div>
    );
  }

  if (error || !driver) {
    return (
      <div className="card text-center py-12">
        <div className="text-4xl mb-3">😕</div>
        <p className="text-gray-600 dark:text-gray-400">{error || 'Pilote introuvable'}</p>
        <button onClick={goBack} className="btn-primary mt-4 inline-block">
          Retour au championnat
        </button>
      </div>
    );
  }

  const totalPoints = results.reduce((sum, r) => sum + r.points, 0);
  const wins = results.filter((r) => r.position === 1).length;
  const podiums = results.filter((r) => r.position != null && r.position <= 3).length;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <button onClick={goBack} className="text-sm text-wc-green dark:text-green-400 hover:underline">
        ← Retour au championnat
      </button>

      {/* Driver header */}
      <div className="card text-center py-8">
        <div className="flex justify-center mb-3">
          <MiniF1Car color={driver.constructorColor} size={72} />
        </div>
        <div className="text-2xl font-black text-gray-900 dark:text-white">{driver.name}</div>
        <div className="text-sm font-bold" style={{ color: driver.constructorColor }}>
          {driver.constructorName} · #{driver.number}
        </div>
      </div>

      {/* Season recap */}
      <div className="card grid grid-cols-3 divide-x divide-gray-100 dark:divide-gray-800 text-center">
        <div>
          <div className="text-2xl font-black text-gray-900 dark:text-white">{totalPoints}</div>
          <div className="text-xs uppercase text-gray-400">Points</div>
        </div>
        <div>
          <div className="text-2xl font-black text-gray-900 dark:text-white">{wins}</div>
          <div className="text-xs uppercase text-gray-400">Victoire{wins > 1 ? 's' : ''}</div>
        </div>
        <div>
          <div className="text-2xl font-black text-gray-900 dark:text-white">{podiums}</div>
          <div className="text-xs uppercase text-gray-400">Podium{podiums > 1 ? 's' : ''}</div>
        </div>
      </div>

      {/* Race by race */}
      <div className="card">
        <h2 className="font-bold text-gray-900 dark:text-white mb-3">🏁 Courses de la saison</h2>
        {results.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <div className="text-4xl mb-3">😅</div>
            <p>Aucun résultat pour le moment</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {results.map((r) => {
              const flag = getFlagUrl(r.countryIso2?.toLowerCase());
              return (
                <div key={r.raceId} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="w-6 text-right font-black text-gray-400">{r.round}</span>
                  {flag
                    ? <img src={flag} alt="" className="w-6 h-4 object-cover rounded shadow shrink-0" />
                    : <span className="w-6 text-center">🏳️</span>}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-900 dark:text-white truncate">{r.raceName}</div>
                    <div className="text-xs text-gray-400">{formatDate(r.raceDate)}</div>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs shrink-0">
                    {r.sprintPosition != null && (
                      <span className="text-purple-500 font-bold" title={`Sprint : P${r.sprintPosition}`}>
                        S{r.sprintPosition}
                      </span>
                    )}
                    {r.pole && <span title="Pole position">⏱</span>}
                    {r.fastestLap && <span title="Meilleur tour">🟣</span>}
                    {r.dnf && <span className="text-gray-400" title="Abandon">DNF</span>}
                    <span className={`w-8 text-right font-black ${r.position && r.position <= 3 ? 'text-wc-gold' : 'text-gray-600 dark:text-gray-300'}`}>
                      {r.position ?? 'NC'}
                    </span>
                    <span className="w-12 text-right font-bold text-wc-green">+{r.points}</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default DriverDetail;
