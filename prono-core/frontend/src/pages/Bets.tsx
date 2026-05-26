import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getBets } from '../api/bets';
import type { Bet } from '../types';

type FilterStatus = 'ALL' | 'OPEN' | 'VALIDATED' | 'CANCELLED';

const Bets: React.FC = () => {
  const [bets, setBets] = useState<Bet[]>([]);
  const [filter, setFilter] = useState<FilterStatus>('ALL');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getBets()
      .then(setBets)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const filteredBets = filter === 'ALL' ? bets : bets.filter((b) => b.status === filter);

  const filters: { label: string; value: FilterStatus }[] = [
    { label: '🌍 Tous', value: 'ALL' },
    { label: '🟢 Ouverts', value: 'OPEN' },
    { label: '✅ Validés', value: 'VALIDATED' },
    { label: '❌ Annulés', value: 'CANCELLED' },
  ];

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div>
      <h1 className="page-title mb-6">🎯 Récap des pronostics</h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card text-center p-3">
          <div className="text-2xl font-black text-wc-green">
            {bets.filter((b) => b.status === 'OPEN').length}
          </div>
          <div className="text-xs text-gray-500">Ouverts</div>
        </div>
        <div className="card text-center p-3">
          <div className="text-2xl font-black text-blue-500">
            {bets.filter((b) => b.status === 'VALIDATED').length}
          </div>
          <div className="text-xs text-gray-500">Validés</div>
        </div>
        <div className="card text-center p-3">
          <div className="text-2xl font-black text-gray-400">{bets.length}</div>
          <div className="text-xs text-gray-500">Total</div>
        </div>
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
            {f.value !== 'ALL' && (
              <span className="ml-1 text-xs opacity-75">
                ({bets.filter((b) => b.status === f.value).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Bet list */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="text-5xl animate-bounce-slow">🎯</div>
          <p className="text-gray-500 mt-3">Chargement...</p>
        </div>
      ) : filteredBets.length === 0 ? (
        <div className="card text-center py-12 text-gray-500 dark:text-gray-400">
          <div className="text-4xl mb-3">🎯</div>
          <p>Aucun pari trouvé</p>
          <p className="text-sm mt-2 text-gray-400">
            Les paris sont créés automatiquement à chaque match.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredBets.map((bet) => (
            <Link
              key={bet.id}
              to={`/matches/${bet.match?.id}`}
              className="card block hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Status + round */}
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        bet.status === 'OPEN'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : bet.status === 'VALIDATED'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                      }`}
                    >
                      {bet.status === 'OPEN'
                        ? '🟢 Ouvert'
                        : bet.status === 'VALIDATED'
                        ? '✅ Validé'
                        : '❌ Annulé'}
                    </span>
                    {bet.match?.round && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {bet.match.round}
                      </span>
                    )}
                  </div>

                  {/* Match name */}
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm">
                    {bet.match
                      ? `${bet.match.teamA} vs ${bet.match.teamB}`
                      : bet.title}
                  </h3>

                  {/* Meta row */}
                  <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                    <span>
                      📅{' '}
                      {bet.match
                        ? formatDate(bet.match.matchDate)
                        : formatDate(bet.deadline)}
                    </span>
                    <span>
                      👥 {bet.participationsCount} prono
                      {bet.participationsCount !== 1 ? 's' : ''}
                    </span>
                    <span>🏅 {bet.points} pts</span>
                  </div>

                  {/* Winning option (validated) */}
                  {bet.winningOption && (
                    <p className="mt-1 text-xs font-semibold text-green-600 dark:text-green-400">
                      🏆 {bet.winningOption}
                    </p>
                  )}
                </div>

                <div className="text-gray-400 dark:text-gray-500 flex-shrink-0 text-lg">→</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default Bets;
