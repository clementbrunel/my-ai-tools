import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getRaces } from '../../api/f1';
import type { Race } from '../../types';
import { formatDate, formatTime } from '../../utils/dates';
import { getFlagUrl } from '../../utils/countryFlags';

type Filter = 'UPCOMING' | 'FINISHED' | 'ALL';

const RaceCard: React.FC<{ race: Race }> = ({ race }) => {
  const now = new Date();
  const raceStarted = new Date(race.raceDate) <= now;
  const finished = race.status === 'FINISHED';
  const flag = getFlagUrl(race.countryIso2?.toLowerCase());

  return (
    <Link
      to={`/f1/races/${race.id}`}
      className="card flex items-center gap-4 hover:border hover:border-wc-green transition-all"
    >
      <div className="flex flex-col items-center w-12 shrink-0">
        <span className="text-[10px] font-bold text-gray-400 uppercase">R{race.round}</span>
        {flag ? (
          <img src={flag} alt={race.countryIso2 ?? ''} className="w-8 h-6 object-cover rounded shadow" />
        ) : (
          <span className="text-2xl">🏁</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-bold text-gray-900 dark:text-white truncate">{race.name}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{race.circuit}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Qualifs {formatDate(race.qualifyingDate)} {formatTime(race.qualifyingDate)} · Course{' '}
          {formatDate(race.raceDate)} {formatTime(race.raceDate)}
        </div>
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0">
        {finished ? (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase">
            Terminé
          </span>
        ) : raceStarted ? (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 uppercase">
            En course
          </span>
        ) : race.userPredicted ? (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 uppercase">
            ✓ Pronostiqué
          </span>
        ) : race.openInUserGroups ? (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-wc-gold/20 text-yellow-700 dark:text-wc-gold uppercase animate-pulse">
            À pronostiquer
          </span>
        ) : (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 uppercase">
            Non ouvert
          </span>
        )}
      </div>
    </Link>
  );
};

const F1Races: React.FC = () => {
  const [races, setRaces] = useState<Race[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('UPCOMING');

  useEffect(() => {
    getRaces()
      .then(setRaces)
      .catch(() => setError('Impossible de charger le calendrier'))
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'ALL') return races;
    if (filter === 'FINISHED') return [...races.filter((r) => r.status === 'FINISHED')].reverse();
    return races.filter((r) => r.status !== 'FINISHED');
  }, [races, filter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="page-title mb-0">🏁 Grands Prix</h1>
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {(
            [
              ['UPCOMING', 'À venir'],
              ['FINISHED', 'Terminés'],
              ['ALL', 'Tous'],
            ] as [Filter, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`px-3 py-1 rounded text-sm font-bold transition-colors ${
                filter === value
                  ? 'bg-white dark:bg-wc-dark-secondary text-gray-900 dark:text-white shadow'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="card bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300">{error}</div>
      )}

      {isLoading ? (
        <div className="card text-center py-12 text-gray-500">Chargement du calendrier…</div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12 space-y-2">
          <div className="text-5xl">🏎</div>
          <p className="text-gray-500 dark:text-gray-400">Aucune course dans cette catégorie</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((race) => (
            <RaceCard key={race.id} race={race} />
          ))}
        </div>
      )}
    </div>
  );
};

export default F1Races;
