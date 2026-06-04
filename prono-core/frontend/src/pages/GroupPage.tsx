import { useEffect, useState } from 'react';
import { getMyGroups, createGroup, joinGroup, leaveGroup, promoteMember, demoteMember, removeMember } from '../api/groups';
import type { Group } from '../types';
import { useAuth } from '../context/AuthContext';

const GroupPage: React.FC = () => {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create group form
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');

  // Join group form
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');

  // Copy feedback
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    getMyGroups()
      .then(setGroups)
      .catch(() => setError('Impossible de charger les groupes'))
      .finally(() => setIsLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const g = await createGroup({ name: createName, description: createDesc });
      setGroups((prev) => [...prev, g]);
      setShowCreate(false);
      setCreateName('');
      setCreateDesc('');
    } catch {
      setError('Erreur lors de la création du groupe');
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const g = await joinGroup({ inviteCode: joinCode.trim().toUpperCase() });
      setGroups((prev) => [...prev, g]);
      setShowJoin(false);
      setJoinCode('');
    } catch {
      setError('Code invalide ou groupe introuvable');
    }
  };

  const handleLeave = async (groupId: number) => {
    if (!confirm('Quitter ce groupe ?')) return;
    try {
      await leaveGroup(groupId);
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sortie du groupe');
    }
  };

  const handlePromote = async (groupId: number, userId: number) => {
    try {
      const updated = await promoteMember(groupId, userId);
      setGroups((prev) =>
        prev.map((g) =>
          g.id !== groupId
            ? g
            : { ...g, members: g.members.map((m) => (m.userId === userId ? { ...m, role: updated.role } : m)) }
        )
      );
    } catch {
      setError('Erreur lors de la promotion');
    }
  };

  const handleDemote = async (groupId: number, userId: number) => {
    try {
      const updated = await demoteMember(groupId, userId);
      setGroups((prev) =>
        prev.map((g) =>
          g.id !== groupId
            ? g
            : { ...g, members: g.members.map((m) => (m.userId === userId ? { ...m, role: updated.role } : m)) }
        )
      );
    } catch {
      setError('Erreur lors de la rétrogradation');
    }
  };

  const handleRemove = async (groupId: number, userId: number, username: string) => {
    if (!confirm(`Exclure ${username} du groupe ?`)) return;
    try {
      await removeMember(groupId, userId);
      setGroups((prev) =>
        prev.map((g) =>
          g.id !== groupId ? g : { ...g, members: g.members.filter((m) => m.userId !== userId), memberCount: g.memberCount - 1 }
        )
      );
    } catch {
      setError("Erreur lors de l'exclusion");
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl animate-bounce-slow">👥</div>
        <p className="text-gray-500 mt-3">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title mb-0">👥 Mes groupes</h1>
        <div className="flex gap-2">
          <button onClick={() => { setShowJoin(true); setShowCreate(false); }} className="btn-secondary text-sm">
            Rejoindre
          </button>
          <button onClick={() => { setShowCreate(true); setShowJoin(false); }} className="btn-primary text-sm">
            + Créer
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-red-700 dark:text-red-400 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-bold">✕</button>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="card space-y-3">
          <h2 className="font-bold text-gray-800 dark:text-white">Nouveau groupe</h2>
          <input
            className="input-field w-full"
            placeholder="Nom du groupe"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            required
            minLength={2}
            maxLength={100}
          />
          <textarea
            className="input-field w-full resize-none"
            placeholder="Description (optionnel)"
            value={createDesc}
            onChange={(e) => setCreateDesc(e.target.value)}
            rows={2}
            maxLength={500}
          />
          <div className="flex gap-2">
            <button type="submit" className="btn-primary text-sm">Créer</button>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary text-sm">Annuler</button>
          </div>
        </form>
      )}

      {/* Join form */}
      {showJoin && (
        <form onSubmit={handleJoin} className="card space-y-3">
          <h2 className="font-bold text-gray-800 dark:text-white">Rejoindre un groupe</h2>
          <input
            className="input-field w-full font-mono uppercase tracking-widest"
            placeholder="CODE D'INVITATION"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            required
          />
          <div className="flex gap-2">
            <button type="submit" className="btn-primary text-sm">Rejoindre</button>
            <button type="button" onClick={() => setShowJoin(false)} className="btn-secondary text-sm">Annuler</button>
          </div>
        </form>
      )}

      {groups.length === 0 ? (
        <div className="card text-center py-10">
          <div className="text-4xl mb-3">👥</div>
          <p className="text-gray-500">Vous n'appartenez à aucun groupe.</p>
          <p className="text-gray-400 text-sm mt-1">Créez un groupe ou rejoignez-en un avec un code d'invitation.</p>
        </div>
      ) : (
        groups.map((group) => {
          const isGroupAdmin = group.currentUserRole === 'GROUP_ADMIN';
          return (
            <div key={group.id} className="card space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-black text-gray-900 dark:text-white">{group.name}</h2>
                  {group.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{group.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">{group.memberCount} membre{group.memberCount > 1 ? 's' : ''}</p>
                </div>
                <button
                  onClick={() => handleLeave(group.id)}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors"
                >
                  Quitter
                </button>
              </div>

              {/* Invite code — visible to all members */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Code d'invitation</p>
                  <span className="font-mono font-bold text-lg tracking-widest text-gray-900 dark:text-white">
                    {group.inviteCode}
                  </span>
                </div>
                <button
                  onClick={() => copyCode(group.inviteCode)}
                  className="btn-secondary text-xs whitespace-nowrap"
                >
                  {copiedCode === group.inviteCode ? '✓ Copié !' : 'Copier'}
                </button>
              </div>

              {/* Members list */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Membres</h3>
                {group.members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-wc-green text-white flex items-center justify-center text-xs font-bold">
                        {member.username[0].toUpperCase()}
                      </div>
                      <span className="text-sm text-gray-800 dark:text-gray-200">{member.username}</span>
                      {member.role === 'GROUP_ADMIN' && (
                        <span className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-1.5 py-0.5 rounded font-medium">
                          Admin
                        </span>
                      )}
                      {member.username === user?.username && (
                        <span className="text-xs text-wc-green dark:text-green-400">(vous)</span>
                      )}
                    </div>
                    {/* Admin actions — not on self */}
                    {isGroupAdmin && member.username !== user?.username && (
                      <div className="flex gap-1">
                        {member.role === 'MEMBER' ? (
                          <button
                            onClick={() => handlePromote(group.id, member.userId)}
                            className="text-xs text-blue-500 hover:text-blue-700 px-1.5 py-0.5"
                            title="Promouvoir admin"
                          >
                            ↑ Admin
                          </button>
                        ) : (
                          <button
                            onClick={() => handleDemote(group.id, member.userId)}
                            className="text-xs text-gray-400 hover:text-gray-600 px-1.5 py-0.5"
                            title="Rétrograder"
                          >
                            ↓ Membre
                          </button>
                        )}
                        <button
                          onClick={() => handleRemove(group.id, member.userId, member.username)}
                          className="text-xs text-red-400 hover:text-red-600 px-1.5 py-0.5"
                          title="Exclure"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default GroupPage;
