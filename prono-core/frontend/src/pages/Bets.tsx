import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getBets } from '../api/bets';
import type { Bet } from '../types';
import BetCard from '../components/BetCard';

type FilterStatus = 'ALL' | 'OPEN' | 'VALIDATED' | 'CANCELLED';

const Bets: React.FC = () => {
  const [bets, setBets] = useState<Bet[]>([]);
  const [filter, setFilter] = useState<FilterStatus>('ALL');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchBets = async () => {
      setIsLoading(true);
      try {
        const data = await getBets();
        setBets(data);
      } catch (err) {
        console.error('Error loading bets:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchBets();
  }, []);

  const filteredBets = filter === 'ALL' ? bets : bets.filter((b) => b.status === filter);

  const filters: { label: string; value: FilterStatus }[] = [
    { label: '🌍 Tous', value: 'ALL' },
    { label: '🟢 Ouverts', value: 'OPEN' },
    { label: '✅ Validés', value: 'VALIDATED' },
    { label: '❌ Annulés', value: 'CANCELLED' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title mb-0">🎯 Paris</h1>
        <Link to="/bets/create" className="btn-primary text-sm">
          + Nouveau pari
        </Link>
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

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card text-center p-3">
          <div className="text-2xl font-black text-wc-green">{bets.filter(b => b.status === 'OPEN').length}</div>
          <div className="text-xs text-gray-500">Ouverts</div>
        </div>
        <div className="card text-center p-3">
          <div className="text-2xl font-black text-blue-500">{bets.filter(b => b.status === 'VALIDATED').length}</div>
          <div className="text-xs text-gray-500">Validés</div>
        </div>
        <div className="card text-center p-3">
          <div className="text-2xl font-black text-gray-400">{bets.length}</div>
          <div className="text-xs text-gray-500">Total</div>
        </div>
      </div>

      {/* Bets */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="text-5xl animate-bounce-slow">🎯</div>
          <p className="text-gray-500 mt-3">Chargement...</p>
        </div>
      ) : filteredBets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBets.map((bet) => (
            <BetCard
              key={bet.id}
              bet={bet}
              onParticipated={() => getBets().then(setBets)}
            />
          ))}
        </div>
      ) : (
        <div className="card text-center py-12 text-gray-500 dark:text-gray-400">
          <div className="text-4xl mb-3">🎯</div>
          <p>Aucun pari trouvé</p>
          <Link to="/bets/create" className="btn-primary mt-4 inline-block text-sm">
            Créer un pari
          </Link>
        </div>
      )}
    </div>
  );
};

export default Bets;
