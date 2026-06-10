import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getParticipatedBets } from '../api/bets';
import { getLeaderboard } from '../api/leaderboard';
import { getMyForfeits, completeForfeit } from '../api/forfeits';
import { updateAvatar, updateDisplayName, updatePassword } from '../api/users';
import type { Bet, LeaderboardEntry, UserForfeitEntry } from '../types';
import { isAdmin } from '../types';
import { formatDate } from '../utils/dates';
import { useToast } from '../components/Toast';

const Profile: React.FC = () => {
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();
  const [myBets, setMyBets] = useState<Bet[]>([]);
  const [leaderboardEntry, setLeaderboardEntry] = useState<LeaderboardEntry | null>(null);
  const [myForfeits, setMyForfeits] = useState<UserForfeitEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [completingId, setCompletingId] = useState<number | null>(null);

  const [showEdit, setShowEdit] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [displayNameSaving, setDisplayNameSaving] = useState(false);
  const [displayNameMsg, setDisplayNameMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [betsData, leaderboardData, forfeitsData] = await Promise.all([
          getParticipatedBets(),
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
      showToast('Erreur lors de la mise à jour du gage');
    } finally {
      setCompletingId(null);
    }
  };

  const handleDisplayNameSave = async () => {
    setDisplayNameSaving(true);
    setDisplayNameMsg(null);
    try {
      const updated = await updateDisplayName(displayName);
      updateUser(updated);
      setDisplayNameMsg({ type: 'success', text: 'Nom affiché mis à jour !' });
    } catch {
      setDisplayNameMsg({ type: 'error', text: 'Impossible de mettre à jour le nom affiché.' });
    } finally {
      setDisplayNameSaving(false);
    }
  };

  const handleAvatarSave = async () => {
    setAvatarSaving(true);
    setAvatarMsg(null);
    try {
      const updated = await updateAvatar(avatarUrl);
      updateUser(updated);
      setAvatarMsg({ type: 'success', text: 'Avatar mis à jour !' });
    } catch {
      setAvatarMsg({ type: 'error', text: 'Impossible de mettre à jour l\'avatar.' });
    } finally {
      setAvatarSaving(false);
    }
  };

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (newPassword !== confirmPassword) {
      setPwMsg({ type: 'error', text: 'Les nouveaux mots de passe ne correspondent pas.' });
      return;
    }
    setPwSaving(true);
    try {
      await updatePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwMsg({ type: 'success', text: 'Mot de passe mis à jour !' });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Impossible de modifier le mot de passe.';
      setPwMsg({ type: 'error', text: message });
    } finally {
      setPwSaving(false);
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

        {/* Edit section */}
        {showEdit && (
          <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-6 space-y-6">

            {/* Display Name */}
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-3">✏️ Nom affiché</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={user?.username}
                  maxLength={100}
                  className="input flex-1"
                />
                <button
                  onClick={handleDisplayNameSave}
                  disabled={displayNameSaving}
                  className="btn-primary flex-shrink-0 disabled:opacity-50"
                >
                  {displayNameSaving ? '...' : 'Enregistrer'}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">Laisser vide pour afficher votre login.</p>
              {displayNameMsg && (
                <p className={`text-sm mt-2 ${displayNameMsg.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                  {displayNameMsg.text}
                </p>
              )}
            </div>

            {/* Avatar */}
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-3">🖼️ Avatar</h3>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://example.com/photo.jpg"
                  className="input flex-1"
                />
                <button
                  onClick={handleAvatarSave}
                  disabled={avatarSaving}
                  className="btn-primary flex-shrink-0 disabled:opacity-50"
                >
                  {avatarSaving ? '...' : 'Enregistrer'}
                </button>
              </div>
              {avatarMsg && (
                <p className={`text-sm mt-2 ${avatarMsg.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                  {avatarMsg.text}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-3">🔒 Changer le mot de passe</h3>
              <form onSubmit={handlePasswordSave} className="space-y-3">
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Mot de passe actuel"
                  required
                  className="input w-full"
                />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nouveau mot de passe (min. 6 caractères)"
                  required
                  minLength={6}
                  className="input w-full"
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirmer le nouveau mot de passe"
                  required
                  className="input w-full"
                />
                <button
                  type="submit"
                  disabled={pwSaving}
                  className="btn-primary w-full disabled:opacity-50"
                >
                  {pwSaving ? '...' : 'Changer le mot de passe'}
                </button>
                {pwMsg && (
                  <p className={`text-sm ${pwMsg.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                    {pwMsg.text}
                  </p>
                )}
              </form>
            </div>
          </div>
        )}
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
          🎯 Mes pronostics ({myBets.length})
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
          <p className="text-gray-500 dark:text-gray-400 text-sm">Vous n'avez encore participé à aucun pari</p>
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
