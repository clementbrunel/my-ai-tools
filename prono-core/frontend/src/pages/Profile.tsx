import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getMyParticipations } from '../api/bets';
import UserBetList from '../components/UserBetList';
import Pagination from '../components/Pagination';
import { getGroupLeaderboard } from '../api/leaderboard';
import { getDashboardStats } from '../api/dashboard';
import { getMyForfeits, completeForfeit } from '../api/forfeits';
import type { UserBetSummary, LeaderboardEntry, UserForfeitEntry } from '../types';
import { isAdmin } from '../types';
import { formatDate } from '../utils/dates';
import { useToast } from '../components/Toast';
import { useUserCounts } from '../context/UserCountsContext';
import ProfileInfoForm from './profile/ProfileInfoForm';
import PasswordForm from './profile/PasswordForm';
import { logger } from '../utils/logger';

const FORFEITS_PAGE_SIZE = 5;

const Profile: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { refresh: refreshUserCounts } = useUserCounts();
  const [myParticipations, setMyParticipations] = useState<UserBetSummary[]>([]);
  const [leaderboardEntry, setLeaderboardEntry] = useState<LeaderboardEntry | null>(null);
  const [myForfeits, setMyForfeits] = useState<UserForfeitEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [completingId, setCompletingId] = useState<number | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showDoneForfeits, setShowDoneForfeits] = useState(false);
  const [doneForfeitsPageRaw, setDoneForfeitsPage] = useState(1);
  const [showPronostics, setShowPronostics] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [participationsData, statsData, forfeitsData] = await Promise.all([
          getMyParticipations(),
          getDashboardStats(),
          getMyForfeits(),
        ]);
        setMyParticipations(participationsData);
        setMyForfeits(forfeitsData);
        const firstGroup = statsData.groupRanks[0];
        if (firstGroup) {
          const groupLeaderboard = await getGroupLeaderboard(firstGroup.groupId);
          const entry = groupLeaderboard.find((e) => e.user.username === user?.username);
          setLeaderboardEntry(entry || null);
        }
      } catch (err) {
        logger.error('Error loading profile:', err);
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
      refreshUserCounts();
    } catch {
      showToast('Erreur lors de la mise à jour du gage');
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
  const doneForfeitsTotal = Math.max(1, Math.ceil(doneForfeits.length / FORFEITS_PAGE_SIZE));
  const doneForfeitsPage = Math.min(doneForfeitsPageRaw, doneForfeitsTotal);
  const doneForfeitsVisible = doneForfeits.slice(
    (doneForfeitsPage - 1) * FORFEITS_PAGE_SIZE,
    doneForfeitsPage * FORFEITS_PAGE_SIZE
  );

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
          <div className="flex-1">
            <h2 className="text-2xl font-black text-gray-900 dark:text-white">
              {user?.displayName || user?.username}
            </h2>
            {user?.displayName && (
              <p className="text-gray-400 dark:text-gray-500 text-xs">@{user.username}</p>
            )}
            <p className="text-gray-500 dark:text-gray-400 text-sm">{user?.email}</p>
            <div className="flex items-center gap-2 mt-2">
              {isAdmin(user) && <span className="badge-admin">Admin</span>}
              {leaderboardEntry && (
                <span className="text-sm text-wc-green dark:text-green-400 font-semibold">
                  #{leaderboardEntry.rank} au classement
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowEdit((v) => !v)}
            className="btn-secondary text-sm flex-shrink-0"
          >
            {showEdit ? 'Fermer' : '✏️ Modifier'}
          </button>
        </div>

        {showEdit && (
          <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-6 space-y-6">
            <ProfileInfoForm
              initialDisplayName={user?.displayName || ''}
              initialAvatarUrl={user?.avatarUrl || ''}
              initialEmail={user?.email || ''}
              initialEmailReminder={user?.emailReminderEnabled ?? true}
              initialEmailGage={user?.emailGageEnabled ?? false}
              usernamePlaceholder={user?.username}
            />
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <PasswordForm />
            </div>
          </div>
        )}
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
                    Assigné par {uf.assignedByDisplayName || uf.assignedByUsername} •{' '}
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
          <button
            onClick={() => { setShowDoneForfeits((v) => !v); setDoneForfeitsPage(1); }}
            className="w-full flex items-center justify-between text-left"
          >
            <h3 className="font-bold text-gray-900 dark:text-white">
              ✅ Gages effectués ({doneForfeits.length})
            </h3>
            <span className="text-gray-400 text-sm">{showDoneForfeits ? '▲' : '▼'}</span>
          </button>
          {showDoneForfeits && (
            <>
              <div className="space-y-2 mt-4">
                {doneForfeitsVisible.map((uf) => (
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
              <Pagination
                currentPage={doneForfeitsPage}
                totalPages={doneForfeitsTotal}
                onPageChange={setDoneForfeitsPage}
              />
            </>
          )}
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
        <button
          onClick={() => setShowPronostics((v) => !v)}
          className="w-full flex items-center justify-between text-left"
        >
          <h3 className="font-bold text-gray-900 dark:text-white">
            🎯 Mes pronostics ({myParticipations.length})
          </h3>
          <span className="text-gray-400 text-sm">{showPronostics ? '▲' : '▼'}</span>
        </button>
        {showPronostics && (
          <div className="mt-4">
            <UserBetList bets={myParticipations} showOpen />
          </div>
        )}
      </div>

      {user?.createdAt && (
        <div className="text-center text-sm text-gray-400 dark:text-gray-500">
          Membre depuis le {formatDate(user.createdAt)}
        </div>
      )}
    </div>
  );
};

export default Profile;
