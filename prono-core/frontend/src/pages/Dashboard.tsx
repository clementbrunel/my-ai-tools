import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getMatches } from '../api/matches';
import { getBets } from '../api/bets';
import { getLeaderboard } from '../api/leaderboard';
import type { Match, Bet, LeaderboardEntry } from '../types';
import MatchCard from '../components/MatchCard';
import BetCard from '../components/BetCard';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [bets, setBets] = useState<Bet[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [matchesData, betsData, leaderboardData] = await Promise.all([
          getMatches(),
          getBets(),
          getLeaderboard(),
        ]);
        setMatches(matchesData);
        setBets(betsData);
        setLeaderboard(leaderboardData);
      } catch (err) {
        console.error('Error loading dashboard:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const upcomingMatches = matches.filter((m) => m.status === 'UPCOMING');
  const openBets = bets.filter((b) => b.status === 'OPEN');
  const userRank = leaderboard.find((e) => e.user.username === user?.username);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-5xl animate-bounce-slow">⚽</div>
          <p className="text-gray-500 mt-3">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="wc-header rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black mb-1">
              Salut {user?.username} ! ⚽
            </h1>
            <p className="text-green-200">
              🏆 Coupe du Monde 2026 — Les paris sont ouverts !
            </p>
          </div>
          <div className="text-6xl hidden md:block animate-bounce-slow">🏆</div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="stat-value">{upcomingMatches.length}</div>
          <div className="stat-label">⚽ Matchs à venir</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{openBets.length}</div>
          <div className="stat-label">🎯 Paris ouverts</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-wc-gold">
            {userRank ? `#${userRank.rank}` : '-'}
          </div>
          <div className="stat-label">🏅 Votre classement</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{user?.globalScore ?? 0}</div>
          <div className="stat-label">⭐ Vos points</div>
        </div>
      </div>

      {/* Recent Matches */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            ⚽ Prochains matchs
          </h2>
          <Link to="/matches" className="text-sm text-wc-green dark:text-green-400 hover:underline">
            Voir tous →
          </Link>
        </div>
        {upcomingMatches.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingMatches.slice(0, 3).map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        ) : (
          <div className="card text-center text-gray-500 dark:text-gray-400 py-8">
            Pas de match à venir pour le moment
          </div>
        )}
      </section>

      {/* Recent Bets */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            🎯 Paris ouverts
          </h2>
          <Link to="/bets" className="text-sm text-wc-green dark:text-green-400 hover:underline">
            Voir tous →
          </Link>
        </div>
        {openBets.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {openBets.slice(0, 3).map((bet) => (
              <BetCard
                key={bet.id}
                bet={bet}
                onParticipated={() => {
                  getBets().then(setBets);
                }}
              />
            ))}
          </div>
        ) : (
          <div className="card text-center text-gray-500 dark:text-gray-400 py-8">
            Aucun pari ouvert pour le moment
          </div>
        )}
      </section>

      {/* Quick Leaderboard */}
      {leaderboard.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              🏆 Top 3 du moment
            </h2>
            <Link to="/leaderboard" className="text-sm text-wc-green dark:text-green-400 hover:underline">
              Classement complet →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {leaderboard.slice(0, 3).map((entry) => {
              const medals = ['🥇', '🥈', '🥉'];
              return (
                <div
                  key={entry.user.id}
                  className={`card text-center border-2 ${
                    entry.rank === 1 ? 'border-wc-gold' : 'border-transparent'
                  }`}
                >
                  <div className="text-3xl mb-2">{medals[entry.rank - 1]}</div>
                  <div className="font-bold text-gray-900 dark:text-white">{entry.user.username}</div>
                  <div className="text-2xl font-black text-wc-gold mt-1">{entry.totalPoints}</div>
                  <div className="text-xs text-gray-500">points</div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};

export default Dashboard;
