import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyGroups, getPublicGroups, createGroup, joinGroup, applyToGroup } from '@/api/groups';
import type { Group, PublicGroup, Sport } from '@/types';
import GroupCard from './groups/GroupCard';

type Tab = 'mine' | 'discover';

const GroupPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('mine');
  const [groups, setGroups] = useState<Group[]>([]);
  const [publicGroups, setPublicGroups] = useState<PublicGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createSports, setCreateSports] = useState<Sport[]>(['FOOT']);

  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [myGroups, pubGroups] = await Promise.all([getMyGroups(), getPublicGroups()]);
      setGroups(myGroups);
      setPublicGroups(pubGroups);
    } catch {
      setError('Impossible de charger les groupes');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const g = await createGroup({ name: createName, description: createDesc, sports: createSports });
      setGroups((prev) => [...prev, g]);
      setShowCreate(false);
      setCreateName('');
      setCreateDesc('');
      setCreateSports(['FOOT']);
      navigate(createSports.includes('F1') && !createSports.includes('FOOT')
        ? '/f1/open-betting'
        : '/foot/open-betting');
    } catch {
      setError('Erreur lors de la création du groupe');
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const g = await joinGroup({ inviteCode: joinCode.trim().toUpperCase() });
      setGroups((prev) => [...prev, g]);
      setPublicGroups((prev) =>
        prev.map((pg) => pg.id === g.id ? { ...pg, currentUserStatus: 'ACTIVE' } : pg)
      );
      setShowJoin(false);
      setJoinCode('');
      setActiveTab('mine');
    } catch {
      setError('Code invalide ou groupe introuvable');
    }
  };

  const handleApply = async (groupId: number) => {
    try {
      const updated = await applyToGroup(groupId);
      setPublicGroups((prev) =>
        prev.map((pg) => pg.id === groupId ? { ...pg, currentUserStatus: updated.currentUserStatus } : pg)
      );
    } catch {
      setError('Erreur lors de la candidature');
    }
  };

  const handleLeaveGroup = (groupId: number) => {
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    setPublicGroups((prev) =>
      prev.map((pg) => pg.id === groupId ? { ...pg, currentUserStatus: null } : pg)
    );
  };

  const handleUpdateGroup = (updated: Group) => {
    setGroups((prev) => prev.map((g) => g.id === updated.id ? updated : g));
    setPublicGroups((prev) =>
      updated.isPrivate
        ? prev.filter((pg) => pg.id !== updated.id)
        : prev
    );
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="page-title mb-0">👥 Groupes</h1>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowJoin(true); setShowCreate(false); }}
            className="btn-secondary text-sm"
          >
            Code d'invitation
          </button>
          <button
            onClick={() => { setShowCreate(true); setShowJoin(false); }}
            className="btn-primary text-sm"
          >
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

      {/* Create group form */}
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
          <div className="flex gap-4 items-center">
            <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">Sports :</span>
            {(
              [
                ['FOOT', '⚽ Foot'],
                ['F1', '🏎 F1'],
              ] as [Sport, string][]
            ).map(([sport, label]) => (
              <label key={sport} className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createSports.includes(sport)}
                  onChange={(e) =>
                    setCreateSports((prev) =>
                      e.target.checked ? [...prev, sport] : prev.filter((x) => x !== sport),
                    )
                  }
                  className="accent-wc-green w-4 h-4"
                />
                {label}
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary text-sm">Créer</button>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary text-sm">Annuler</button>
          </div>
        </form>
      )}

      {/* Join via invite code form */}
      {showJoin && (
        <form onSubmit={handleJoin} className="card space-y-3">
          <h2 className="font-bold text-gray-800 dark:text-white">Rejoindre avec un code</h2>
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

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('mine')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'mine'
              ? 'border-wc-green text-wc-green dark:text-green-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Mes groupes
          {groups.length > 0 && (
            <span className="ml-1.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs px-1.5 py-0.5 rounded-full">
              {groups.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('discover')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'discover'
              ? 'border-wc-green text-wc-green dark:text-green-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Découvrir
          {publicGroups.length > 0 && (
            <span className="ml-1.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs px-1.5 py-0.5 rounded-full">
              {publicGroups.length}
            </span>
          )}
        </button>
      </div>

      {/* MY GROUPS TAB */}
      {activeTab === 'mine' && (
        <>
          {groups.length === 0 ? (
            <div className="card text-center py-10">
              <div className="text-4xl mb-3">👥</div>
              <p className="text-gray-500">Vous n'appartenez à aucun groupe.</p>
              <p className="text-gray-400 text-sm mt-1">
                Créez un groupe, utilisez un code d'invitation, ou postulez depuis l'onglet{' '}
                <button onClick={() => setActiveTab('discover')} className="text-wc-green underline">
                  Découvrir
                </button>.
              </p>
            </div>
          ) : (
            groups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                onLeave={handleLeaveGroup}
                onUpdate={handleUpdateGroup}
              />
            ))
          )}
        </>
      )}

      {/* DISCOVER TAB */}
      {activeTab === 'discover' && (
        <>
          {publicGroups.length === 0 ? (
            <div className="card text-center py-10">
              <div className="text-4xl mb-3">🔍</div>
              <p className="text-gray-500">Aucun groupe public disponible pour le moment.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {publicGroups.map((pg) => {
                const isMember = pg.currentUserStatus === 'ACTIVE';
                const isPending = pg.currentUserStatus === 'PENDING';
                return (
                  <div key={pg.id} className="card flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-gray-900 dark:text-white">{pg.name}</h3>
                      </div>
                      {pg.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate">{pg.description}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {pg.memberCount} membre{pg.memberCount > 1 ? 's' : ''} · par {pg.createdByDisplayName || pg.createdByUsername}
                      </p>
                    </div>
                    <div className="shrink-0">
                      {isMember ? (
                        <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded font-medium">
                          ✓ Membre
                        </span>
                      ) : isPending ? (
                        <span className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-2 py-1 rounded font-medium">
                          ⏳ En attente
                        </span>
                      ) : (
                        <button
                          onClick={() => handleApply(pg.id)}
                          className="text-xs btn-primary py-1 px-3"
                        >
                          Postuler
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default GroupPage;
