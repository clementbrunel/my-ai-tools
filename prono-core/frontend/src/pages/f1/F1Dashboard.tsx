import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDriverStandings, getRaces } from '@/api/f1';
import type { F1Standing, Race } from '@/types';
import { formatDate, formatTime } from '@/utils/dates';
import { getFlagUrl } from '@/utils/countryFlags';
import MiniF1Car from '@/components/f1/MiniF1Car';

const F1Dashboard: React.FC = () => {
  const [races, setRaces] = useState<Race[]>([]);
  const [standings, setStandings] = useState<F1Standing[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([getRaces(), getDriverStandings()])
      .then(([raceRows, standingRows]) => {
        setRaces(raceRows);
        setStandings(standingRows);
      })
      .catch(() => { /* dashboard stays minimal on error */ })
      .finally(() => setIsLoading(false));
  }, []);

  const nextRace = useMemo(
    () => races.find((r) => r.status !== 'FINISHED' && new Date(r.raceDate) > new Date()),
    [races],
  );
  const lastFinished = useMemo(
    () => [...races].reverse().find((r) => r.status === 'FINISHED'),
    [races],
  );
  const top3 = standings.slice(0, 3);
  const flag = getFlagUrl(nextRace?.countryIso2?.toLowerCase());

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="wc-header rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-black">F1 Prono 🏎</h1>
            <p className="text-white/70">Podium, pole, meilleur tour… à toi de jouer !</p>
          </div>
          <div className="text-6xl hidden md:block">🏁</div>
        </div>
      </div>

      {/* Next race */}
      {!isLoading && nextRace && (
        <Link to={`/f1/races/${nextRace.id}`} className="card flex items-center gap-4 hover:border hover:border-wc-green transition-all block">
          {flag ? (
            <img src={flag} alt="" className="w-12 h-8 object-cover rounded shadow shrink-0" />
          ) : (
            <span className="text-4xl shrink-0">🏁</span>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold uppercase text-gray-400">Prochain Grand Prix</div>
            <div className="font-bold text-gray-900 dark:text-white truncate">{nextRace.name}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Course le {formatDate(nextRace.raceDate)} à {formatTime(nextRace.raceDate)}
            </div>
          </div>
          <span
            className={`text-xs font-bold px-3 py-1.5 rounded-full shrink-0 ${
              nextRace.userPredicted
                ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                : nextRace.openInUserGroups
                  ? 'bg-wc-gold/20 text-yellow-700 dark:text-wc-gold animate-pulse'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
            }`}
          >
            {nextRace.userPredicted ? '✓ Pronostiqué' : nextRace.openInUserGroups ? 'À pronostiquer !' : 'Pas encore ouvert'}
          </span>
        </Link>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link to="/f1/races" className="card flex items-center gap-4 hover:border hover:border-wc-green transition-all group">
          <span className="text-4xl">🏁</span>
          <div>
            <div className="font-bold text-gray-900 dark:text-white group-hover:text-wc-green">Grands Prix</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Calendrier & pronos</div>
          </div>
        </Link>
        <Link to="/f1/standings" className="card flex items-center gap-4 hover:border hover:border-wc-green transition-all group">
          <span className="text-4xl">📊</span>
          <div>
            <div className="font-bold text-gray-900 dark:text-white group-hover:text-wc-green">Championnat</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Pilotes & constructeurs</div>
          </div>
        </Link>
        <Link to="/f1/leaderboard" className="card flex items-center gap-4 hover:border hover:border-wc-green transition-all group">
          <span className="text-4xl">🏆</span>
          <div>
            <div className="font-bold text-gray-900 dark:text-white group-hover:text-wc-green">Classement</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Ton groupe, points F1</div>
          </div>
        </Link>
      </div>

      {/* Championship top 3 */}
      {top3.length > 0 && (
        <div className="card space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-900 dark:text-white">Top 3 du championnat</h2>
            <Link to="/f1/standings" className="text-xs text-wc-green font-bold hover:underline">
              Tout le classement →
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {top3.map((standing) => (
              <div key={standing.driver?.id ?? standing.constructorId} className="flex flex-col items-center gap-1 py-2">
                <MiniF1Car color={standing.constructorColor} size={44} />
                <span className="font-black text-sm text-gray-900 dark:text-white">
                  {standing.driver?.code}
                </span>
                <span className="text-xs text-gray-400">{standing.points} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Last result */}
      {lastFinished && (
        <Link to={`/f1/races/${lastFinished.id}`} className="card flex items-center gap-4 hover:border hover:border-wc-green transition-all block">
          <span className="text-3xl shrink-0">🏆</span>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold uppercase text-gray-400">Dernier résultat</div>
            <div className="font-bold text-gray-900 dark:text-white truncate">{lastFinished.name}</div>
          </div>
          <span className="text-xs text-gray-400 shrink-0">Voir mes points →</span>
        </Link>
      )}

      {isLoading && <div className="card text-center py-8 text-gray-500">Chargement…</div>}
    </div>
  );
};

export default F1Dashboard;
