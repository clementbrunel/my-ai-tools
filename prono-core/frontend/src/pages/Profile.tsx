import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getMyBets } from '../api/bets';
import { getLeaderboard } from '../api/leaderboard';
import { getMyForfeits, completeForfeit } from '../api/forfeits';
import type { Bet, LeaderboardEntry, UserForfeitEntry } from '../types';
import { formatDate } from '../utils/dates';

const Profile: React.FC = () => {
  const { user } = useAuth();
  const [myBets, setMyBets] = useState<Bet[]>([]);
  const [leaderboardEntry, setLeaderboardEntry] = useState<LeaderboardEntry | null>(null);
  const [myForfeits, setMyForfeits] = useState<UserForfeitEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [completingId, setCompletingId] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [betsData, leaderboardData, forfeitsData] = await Promise.all([
          getMyBets(),
          getLeaderboard(),
          getMyForfeits(),
        ]);
        setMyBets(betsData);
        const entry = leaderboardData.find((e) => e.user.username === user?.username);
        setLeaderboardEntry(entry || null);
        setMyForfeits(forfeitsData);
      } catch (err) {
        console.error('Error loading profile:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const handleComplete = async (userForfeitId: number) => {
    setCompletingId(userForfeitId);
    try {
      await completeForfeit(userForfeitId);
      setMyForfeits((prev) =>
        prev.map((uf) =>
          uf.id === userForfeitId
            ? { ...uf, completed: true, completedAt: new Date().toISOString() }
            : uf
        )
      );
    } catch {
      alert('Erreur lors de la mise à jour du gage');
    } finally {
      setCompletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl animate-bounce-slow">👤</div>
        <p className="text-gray-500 mt-3">Chargement...</p>
      </div>
    );
  }

  const pendingForfeits = myForfeits.filter((f) => !f.completed);
  const doneForfeits = myForfeits.filter((f) => f.completed);

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
          <div className="stat-value">{leaderboardEntry?.totalPoints ?? user?.globalScore ?? 0}</div>
          <div className="stat-label">⭐ Points</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{leaderboardEntry?.betsWon ?? user?.betsWon ?? 0}</div>
          <div className="stat-label">🏆 Paris gagnés</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-wc-red">{leaderboardEntry?.forfeitsReceived ?? user?.forfeitsReceived ?? 0}</div>
          <div className="stat-label">🃏 Gages reçus</div>
        </div>
      </div>

      {/* Pending Forfeits */}
      {pendingForfeits.length > 0 && (
        <div className="card border-2 border-wc-red">
          <h3 className="font-bold text-wc-red mb-4">
            🔴 Mes gages à effectuer ({pendingForfeits.length})
          </h3>
          <div className="space-y-3">
            {pendingForfeits.map((uf) => (
              <div
                key={uf.id}
                className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800"
              >
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white">{uf.forfeit.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{uf.forfeit.description}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    Assigné par {uf.assignedByUsername} •{' '}
                    {formatDate(uf.assignedAt)}
                  </div>
                </div>
                <button
                  onClick={() => handleComplete(uf.id)}
                  disabled={completingId === uf.id}
                  className="btn-primary text-sm ml-4 flex-shrink-0 disabled:opacity-50"
                >
                  {completingId === uf.id ? '...' : '✅ Fait !'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed Forfeits */}
      {doneForfeits.length > 0 && (
        <div className="card">
          <h3 className="font-bold text-gray-900 dark:text-white mb-4">
            ✅ Gages effectués ({doneForfeits.length})
          </h3>
          <div className="space-y-2">
            {doneForfeits.map((uf) => (
              <div
                key={uf.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg opacity-70"
              >
                <div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 line-through">
                    {uf.forfeit.title}
                  </div>
                  {uf.completedAt && (
                    <div className="text-xs text-gray-400">
                      Effectué le {formatDate(uf.completedAt)}
                    </div>
                  )}
                </div>
                <span className="text-green-500 text-lg">✅</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {myForfeits.length === 0 && (
        <div className="card text-center py-6">
          <div className="text-3xl mb-2">🏅</div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Aucun gage reçu — tu t'en sors bien !</p>
        </div>
      )}

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
          Membre depuis le {formatDate(user.createdAt)}
        </div>
      )}
    </div>
  );
};

export default Profile;
