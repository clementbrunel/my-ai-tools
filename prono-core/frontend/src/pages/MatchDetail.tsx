import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getMatch } from '../api/matches';
import { getBetsByMatch } from '../api/bets';
import type { Match, Bet } from '../types';
import BetCard from '../components/BetCard';

const MatchDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [match, setMatch] = useState<Match | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        const [matchData, betsData] = await Promise.all([
          getMatch(parseInt(id)),
          getBetsByMatch(parseInt(id)),
        ]);
        setMatch(matchData);
        setBets(betsData);
      } catch {
        setError('Match introuvable');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [id]);

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl animate-bounce-slow">⚽</div>
        <p className="text-gray-500 mt-3">Chargement...</p>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="card text-center py-12">
        <div className="text-4xl mb-3">😕</div>
        <p className="text-gray-600 dark:text-gray-400">{error || 'Match introuvable'}</p>
        <Link to="/matches" className="btn-primary mt-4 inline-block">
          Retour aux matchs
        </Link>
      </div>
    );
  }

  const matchDate = new Date(match.matchDate);

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link to="/matches" className="text-sm text-wc-green dark:text-green-400 hover:underline">
        ← Retour aux matchs
      </Link>

      {/* Match Header */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className={`badge-${match.status.toLowerCase()} mr-2`}>
              {match.status === 'UPCOMING' ? '📅 À venir' : match.status === 'ONGOING' ? '🔴 En cours' : '✅ Terminé'}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">{match.round}</span>
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400">{match.competition}</span>
        </div>

        {/* Teams */}
        <div className="flex items-center justify-between gap-4 py-6">
          <div className="flex-1 text-center">
            <div className="text-5xl mb-3">🏳️</div>
            <div className="text-2xl font-black text-gray-900 dark:text-white">{match.teamA}</div>
          </div>

          <div className="text-center">
            {match.status !== 'UPCOMING' ? (
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-5xl font-black text-wc-gold">{match.scoreA ?? '-'}</span>
                  <span className="text-3xl text-gray-400 font-bold">-</span>
                  <span className="text-5xl font-black text-wc-gold">{match.scoreB ?? '-'}</span>
                </div>
                {match.status === 'ONGOING' && (
                  <div className="mt-2 animate-pulse text-wc-red font-bold">🔴 EN DIRECT</div>
                )}
              </div>
            ) : (
              <div>
                <div className="text-2xl font-bold text-gray-400 dark:text-gray-500">VS</div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  {matchDate.toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </div>
                <div className="text-lg font-bold text-gray-700 dark:text-gray-300">
                  {matchDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 text-center">
            <div className="text-5xl mb-3">🏳️</div>
            <div className="text-2xl font-black text-gray-900 dark:text-white">{match.teamB}</div>
          </div>
        </div>
      </div>

      {/* Bets for this match */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            🎯 Paris sur ce match ({bets.length})
          </h2>
          <Link
            to={`/bets/create?matchId=${match.id}`}
            className="btn-primary text-sm"
          >
            + Créer un pari
          </Link>
        </div>

        {bets.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {bets.map((bet) => (
              <BetCard
                key={bet.id}
                bet={bet}
                showMatch={false}
                onParticipated={() => {
                  getBetsByMatch(parseInt(id!)).then(setBets);
                }}
              />
            ))}
          </div>
        ) : (
          <div className="card text-center py-8 text-gray-500 dark:text-gray-400">
            <div className="text-3xl mb-2">🎯</div>
            <p>Aucun pari sur ce match.</p>
            <Link to={`/bets/create?matchId=${match.id}`} className="btn-gold mt-4 inline-block text-sm">
              Créer le premier pari !
            </Link>
          </div>
        )}
      </section>
    </div>
  );
};

export default MatchDetail;
