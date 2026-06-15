import React, { useEffect, useState } from 'react';
import { useToast } from '../../components/Toast';
import { getAllUsersAdmin, adminUnlockUser } from '../../api/users';
import type { UserAdminInfo } from '../../types';
import { formatDate } from '../../utils/dates';

const AdminUsersTab: React.FC = () => {
  const { showToast } = useToast();
  const [platformUsers, setPlatformUsers] = useState<UserAdminInfo[]>([]);
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);
  const [unlockingUser, setUnlockingUser] = useState<UserAdminInfo | null>(null);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getAllUsersAdmin()
      .then(setPlatformUsers)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const handleUnlockUser = async () => {
    if (!unlockingUser) return;
    setUnlockLoading(true);
    try {
      const updated = await adminUnlockUser(unlockingUser.id, unlockPassword || undefined);
      setPlatformUsers(prev => prev.map(u => u.id === updated.id ? { ...u, ...updated } : u));
      showToast(`✅ ${unlockingUser.username} débloqué`, 'success');
      setUnlockingUser(null);
      setUnlockPassword('');
    } catch {
      showToast('Erreur lors du déblocage');
    } finally {
      setUnlockLoading(false);
    }
  };

  if (isLoading) {
    return <div className="card text-center py-8 text-gray-500">Chargement...</div>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {platformUsers.length} utilisateur{platformUsers.length !== 1 ? 's' : ''} inscrit{platformUsers.length !== 1 ? 's' : ''}
      </p>

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <th className="py-3 px-4 text-left text-xs text-gray-500 uppercase">Utilisateur</th>
                <th className="py-3 px-4 text-left text-xs text-gray-500 uppercase">Nom affiché</th>
                <th className="py-3 px-4 text-left text-xs text-gray-500 uppercase">Email</th>
                <th className="py-3 px-4 text-center text-xs text-gray-500 uppercase">Vérifié</th>
                <th className="py-3 px-4 text-center text-xs text-gray-500 uppercase">Rôle</th>
                <th className="py-3 px-4 text-center text-xs text-gray-500 uppercase">Groupes</th>
                <th className="py-3 px-4 text-center text-xs text-gray-500 uppercase">Inscrit le</th>
                <th className="py-3 px-4 text-center text-xs text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody>
              {platformUsers.map((u) => (
                <React.Fragment key={u.id}>
                  <tr
                    onClick={() => setExpandedUserId(expandedUserId === u.id ? null : u.id)}
                    className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {u.avatarUrl ? (
                          <img src={u.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-wc-green/20 flex items-center justify-center text-xs font-bold text-wc-green">
                            {u.username.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{u.username}</span>
                        {expandedUserId === u.id && <span className="text-xs text-gray-400">▲</span>}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-400">
                      {u.displayName ?? <span className="italic text-gray-300 dark:text-gray-600">—</span>}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-400">{u.email}</td>
                    <td className="py-3 px-4 text-center">
                      {u.emailVerified
                        ? <span title="Email vérifié" className="text-green-500 text-base">✓</span>
                        : <span title="Email non vérifié" className="text-red-400 text-base font-bold">✗</span>
                      }
                    </td>
                    <td className="py-3 px-4 text-center">
                      {u.role === 'PLATFORM_ADMIN' ? (
                        <span className="badge-admin text-xs">ADMIN</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                          Joueur
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                        {u.groups.filter(g => g.status === 'ACTIVE').length}
                      </span>
                      {u.groups.some(g => g.status === 'PENDING') && (
                        <span className="ml-1 text-xs text-amber-500">
                          (+{u.groups.filter(g => g.status === 'PENDING').length} en attente)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center text-xs text-gray-400">
                      {u.createdAt ? formatDate(u.createdAt) : '—'}
                    </td>
                    <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => { setUnlockingUser(u); setUnlockPassword(''); }}
                        className="text-xs text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200 whitespace-nowrap"
                        title="Forcer emailVerified + optionnellement changer le MDP"
                      >
                        🔓 Débloquer
                      </button>
                    </td>
                  </tr>

                  {expandedUserId === u.id && (
                    <tr className="bg-indigo-50 dark:bg-indigo-900/10 border-b border-indigo-100 dark:border-indigo-800">
                      <td colSpan={8} className="px-6 py-3">
                        {u.groups.length === 0 ? (
                          <p className="text-sm text-gray-400 italic">Aucun groupe</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {u.groups.map((g) => (
                              <div
                                key={g.groupId}
                                className="flex items-center gap-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm"
                              >
                                <span className="font-medium text-gray-900 dark:text-white">{g.groupName}</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                                  g.role === 'GROUP_ADMIN'
                                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                                }`}>
                                  {g.role === 'GROUP_ADMIN' ? 'Admin' : 'Membre'}
                                </span>
                                {g.status === 'PENDING' && (
                                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 font-medium">
                                    En attente
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {unlockingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-wc-dark-secondary rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
              🔓 Débloquer {unlockingUser.username}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Force <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">emailVerified = true</code> et permet optionnellement de définir un nouveau mot de passe.
            </p>
            <div className="space-y-3 mb-5">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-600 dark:text-gray-400">Email vérifié actuel :</span>
                {unlockingUser.emailVerified
                  ? <span className="text-green-600 font-semibold">✓ Oui</span>
                  : <span className="text-red-500 font-semibold">✗ Non — sera forcé à Oui</span>
                }
              </div>
              <div>
                <label className="label">Nouveau mot de passe <span className="text-gray-400 font-normal">(optionnel)</span></label>
                <input
                  type="password"
                  value={unlockPassword}
                  onChange={(e) => setUnlockPassword(e.target.value)}
                  className="input-field"
                  placeholder="Laisser vide pour garder l'actuel"
                  minLength={6}
                  autoComplete="new-password"
                />
                {unlockPassword && unlockPassword.length < 6 && (
                  <p className="text-xs text-red-400 mt-1">Minimum 6 caractères</p>
                )}
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setUnlockingUser(null); setUnlockPassword(''); }}
                className="btn-secondary flex-1"
                disabled={unlockLoading}
              >
                Annuler
              </button>
              <button
                onClick={handleUnlockUser}
                disabled={unlockLoading || (unlockPassword.length > 0 && unlockPassword.length < 6)}
                className="btn-primary flex-1"
              >
                {unlockLoading ? '⏳ En cours...' : '🔓 Débloquer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsersTab;
