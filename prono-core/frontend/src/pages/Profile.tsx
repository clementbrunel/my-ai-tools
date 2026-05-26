import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getBets } from '../api/bets';
import { getLeaderboard } from '../api/leaderboard';
import type { Bet, LeaderboardEntry } from '../types';

const Profile: React.FC = () => {
  const { user } = useAuth();
  const [myBets, setMyBets] = useState<Bet[]>([]);
  const [leaderboardEntry, setLeaderboardEntry] = useState<LeaderboardEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [betsData, leaderboardData] = await Promise.all([
          getBets(),
          getLeaderboard(),
        ]);
        const createdBets = betsData.filter((b) => b.creator.username === user?.username);
        setMyBets(createdBets);
        const entry = leaderboardData.find((e) => e.user.username === user?.username);
        setLeaderboardEntry(entry || null);
      } catch (err) {
        console.error('Error loading profile:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [user]);

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl animate-bounce-slow">👤</div>
        <p className="text-gray-500 mt-3">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="page-title">👤 Mon profil</h1>

      {/* Profile Card */}
      <div className="card">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-wc-green text-white flex items-center justify-center font-black text-3xl">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.username} className="w-20 h-20 rounded-full object-cover" />
            ) : (
              user?.username[0].toUpperCase()
            )}
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white">{user?.username}</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm">{user?.email}</p>
            <div className="flex items-center gap-2 mt-2">
              {user?.role === 'ADMIN' && <span className="badge-admin">Admin</span>}
              {leaderboardEntry && (
                <span className="text-sm text-wc-green dark:text-green-400 font-semibold">
                  #{leaderboardEntry.rank} au classement
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="stat-value">{user?.globalScore ?? 0}</div>
          <div className="stat-label">⭐ Points</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{user?.betsWon ?? 0}</div>
          <div className="stat-label">🏆 Paris gagnés</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-wc-red">{user?.forfeitsReceived ?? 0}</div>
          <div className="stat-label">🃏 Gages reçus</div>
        </div>
      </div>

      {/* My bets */}
      <div className="card">
        <h3 className="font-bold text-gray-900 dark:text-white mb-4">
          🎯 Mes paris créés ({myBets.length})
        </h3>
        {myBets.length > 0 ? (
          <div className="space-y-2">
            {myBets.slice(0, 5).map((bet) => (
              <div
                key={bet.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{bet.title}</div>
                  <div className="text-xs text-gray-500">
                    {bet.participationsCount} participants • {bet.points} pts
                  </div>
                </div>
                <span className={`badge-${bet.status.toLowerCase()}`}>
                  {bet.status === 'OPEN' ? '🟢' : bet.status === 'VALIDATED' ? '✅' : '❌'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 text-sm">Vous n'avez encore créé aucun pari</p>
        )}
      </div>

      {/* Member since */}
      {user?.createdAt && (
        <div className="text-center text-sm text-gray-400 dark:text-gray-500">
          Membre depuis le {new Date(user.createdAt).toLocaleDateString('fr-FR', {
            day: 'numeric', month: 'long', year: 'numeric'
          })}
        </div>
      )}
    </div>
  );
};

export default Profile;
