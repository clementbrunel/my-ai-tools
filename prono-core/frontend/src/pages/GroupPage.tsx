import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getMyGroups, getPublicGroups, createGroup, joinGroup, applyToGroup,
  approveApplication, rejectApplication, updateGroupPrivacy,
  leaveGroup, promoteMember, demoteMember, removeMember,
} from '../api/groups';
import {
  getGroupPendingForfeits, getGroupForfeits,
  approveGroupForfeit, deleteGroupForfeit, getForfeits,
} from '../api/forfeits';
import {
  getAllDailyGages, createDailyGage,
  selectForfeitDirectly, addCandidate, removeCandidate,
} from '../api/dailyGages';
import { getMatches } from '../api/matches';
import type { Group, PublicGroup, Forfeit, DailyGage, Match } from '../types';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/dates';

type Tab = 'mine' | 'discover';
type AdminSection = 'forfeits' | 'daily-gages';

const parseDDMMYYYY = (s: string): string => {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
};

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    PENDING: 'bg-gray-100 text-gray-600',
    ACTIVE: 'bg-green-100 text-green-700',
    SETTLED: 'bg-blue-100 text-blue-700',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${map[status] ?? ''}`}>
      {status}
    </span>
  );
};

const GroupPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('mine');

  const [groups, setGroups] = useState<Group[]>([]);
  const [publicGroups, setPublicGroups] = useState<PublicGroup[]>([]);
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

  // ---- Group admin state ----
  const [openAdminSection, setOpenAdminSection] = useState<Record<number, AdminSection | null>>({});

  // Pending proposed forfeits per group
  const [groupPendingForfeits, setGroupPendingForfeits] = useState<Record<number, Forfeit[]>>({});
  // Active group-specific forfeits per group
  const [groupActiveForfeits, setGroupActiveForfeits] = useState<Record<number, Forfeit[]>>({});

  // Daily gages per group
  const [groupDailyGages, setGroupDailyGages] = useState<Record<number, DailyGage[]>>({});
  // All forfeits visible to current user (shared + their groups) — for the daily gage picker
  const [availableForfeits, setAvailableForfeits] = useState<Forfeit[]>([]);
  // All matches — for unconfigured match days
  const [allMatches, setAllMatches] = useState<Match[]>([]);

  // Daily gage creation form — per group
  const [dgDate, setDgDate] = useState<Record<number, string>>({});
  const [dgDateDisplay, setDgDateDisplay] = useState<Record<number, string>>({});
  const [dgMode, setDgMode] = useState<Record<number, 'DIRECT' | 'VOTE'>>({});
  const [dgError, setDgError] = useState<Record<number, string>>({});
  const [dgSuccess, setDgSuccess] = useState<Record<number, string>>({});

  // Daily gage management — per group
  const [expandedDg, setExpandedDg] = useState<Record<number, number | null>>({});
  const [selectedForfeit, setSelectedForfeit] = useState<Record<number, number | ''>>({});

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

  // ---- Admin section toggle ----
  const toggleAdminSection = async (groupId: number, section: AdminSection) => {
    const current = openAdminSection[groupId];
    const next = current === section ? null : section;
    setOpenAdminSection((prev) => ({ ...prev, [groupId]: next }));

    if (next === null) return;

    if (next === 'forfeits') {
      try {
        const [pending, active] = await Promise.all([
          getGroupPendingForfeits(groupId),
          getGroupForfeits(groupId),
        ]);
        setGroupPendingForfeits((prev) => ({ ...prev, [groupId]: pending }));
        setGroupActiveForfeits((prev) => ({ ...prev, [groupId]: active }));
      } catch {
        setError('Erreur lors du chargement des gages');
      }
    }

    if (next === 'daily-gages') {
      try {
        const [allDg, forfeits, matches] = await Promise.all([
          getAllDailyGages(),
          getForfeits(),
          getMatches(),
        ]);
        const groupDg = allDg.filter((dg) => dg.groupId === groupId);
        setGroupDailyGages((prev) => ({ ...prev, [groupId]: groupDg }));
        setAvailableForfeits(forfeits);
        setAllMatches(matches);
        if (!dgMode[groupId]) {
          setDgMode((prev) => ({ ...prev, [groupId]: 'DIRECT' }));
        }
      } catch {
        setError('Erreur lors du chargement des gages du jour');
      }
    }
  };

  // ---- Forfeit handlers ----
  const handleApproveForfeits = async (groupId: number, forfeitId: number) => {
    try {
      const approved = await approveGroupForfeit(groupId, forfeitId);
      setGroupPendingForfeits((prev) => ({
        ...prev,
        [groupId]: (prev[groupId] ?? []).filter((f) => f.id !== forfeitId),
      }));
      setGroupActiveForfeits((prev) => ({
        ...prev,
        [groupId]: [...(prev[groupId] ?? []), approved],
      }));
    } catch {
      setError('Erreur lors de la validation du gage');
    }
  };

  const handleDeleteGroupForfeit = async (groupId: number, forfeitId: number) => {
    if (!confirm('Supprimer ce gage du groupe ?')) return;
    try {
      await deleteGroupForfeit(groupId, forfeitId);
      setGroupActiveForfeits((prev) => ({
        ...prev,
        [groupId]: (prev[groupId] ?? []).filter((f) => f.id !== forfeitId),
      }));
    } catch {
      setError('Erreur lors de la suppression');
    }
  };

  const handleRejectGroupForfeit = async (groupId: number, forfeitId: number) => {
    try {
      await deleteGroupForfeit(groupId, forfeitId);
      setGroupPendingForfeits((prev) => ({
        ...prev,
        [groupId]: (prev[groupId] ?? []).filter((f) => f.id !== forfeitId),
      }));
    } catch {
      setError('Erreur lors du refus du gage');
    }
  };

  // ---- Daily gage handlers ----
  const handleCreateDailyGage = async (e: React.FormEvent, groupId: number) => {
    e.preventDefault();
    setDgError((prev) => ({ ...prev, [groupId]: '' }));
    setDgSuccess((prev) => ({ ...prev, [groupId]: '' }));
    const date = dgDate[groupId];
    if (!date) {
      setDgError((prev) => ({ ...prev, [groupId]: 'Date invalide — utilisez le format JJ/MM/AAAA.' }));
      return;
    }
    try {
      const created = await createDailyGage(groupId, date, dgMode[groupId] ?? 'DIRECT');
      setGroupDailyGages((prev) => ({
        ...prev,
        [groupId]: [created, ...(prev[groupId] ?? [])],
      }));
      setDgDate((prev) => ({ ...prev, [groupId]: '' }));
      setDgDateDisplay((prev) => ({ ...prev, [groupId]: '' }));
      setDgSuccess((prev) => ({ ...prev, [groupId]: 'Gage du jour créé !' }));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setDgError((prev) => ({
        ...prev,
        [groupId]: msg ?? 'Erreur — peut-être un gage existe déjà pour cette date ?',
      }));
    }
  };

  const handleSelectDirectly = async (groupId: number, dgId: number) => {
    const fId = selectedForfeit[groupId];
    if (!fId) return;
    try {
      const updated = await selectForfeitDirectly(dgId, Number(fId));
      setGroupDailyGages((prev) => ({
        ...prev,
        [groupId]: (prev[groupId] ?? []).map((dg) => (dg.id === updated.id ? updated : dg)),
      }));
      setSelectedForfeit((prev) => ({ ...prev, [groupId]: '' }));
    } catch {
      setError('Erreur lors de la sélection du gage');
    }
  };

  const handleAddCandidate = async (groupId: number, dgId: number) => {
    const fId = selectedForfeit[groupId];
    if (!fId) return;
    try {
      const updated = await addCandidate(dgId, Number(fId));
      setGroupDailyGages((prev) => ({
        ...prev,
        [groupId]: (prev[groupId] ?? []).map((dg) => (dg.id === updated.id ? updated : dg)),
      }));
      setSelectedForfeit((prev) => ({ ...prev, [groupId]: '' }));
    } catch {
      setError('Erreur — ce gage est peut-être déjà candidat ?');
    }
  };

  const handleRemoveCandidate = async (groupId: number, dgId: number, forfeitId: number) => {
    try {
      const updated = await removeCandidate(dgId, forfeitId);
      setGroupDailyGages((prev) => ({
        ...prev,
        [groupId]: (prev[groupId] ?? []).map((dg) => (dg.id === updated.id ? updated : dg)),
      }));
    } catch {
      setError('Erreur lors du retrait du candidat');
    }
  };

  // ---- Group membership handlers ----
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

  const handleLeave = async (groupId: number) => {
    if (!confirm('Quitter ce groupe ?')) return;
    try {
      await leaveGroup(groupId);
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
      setPublicGroups((prev) =>
        prev.map((pg) => pg.id === groupId ? { ...pg, currentUserStatus: null } : pg)
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sortie du groupe');
    }
  };

  const handleApprove = async (groupId: number, userId: number) => {
    try {
      await approveApplication(groupId, userId);
      setGroups((prev) =>
        prev.map((g) => {
          if (g.id !== groupId) return g;
          const approved = g.pendingApplications?.find((a) => a.userId === userId);
          if (!approved) return g;
          return {
            ...g,
            memberCount: g.memberCount + 1,
            members: [...g.members, { ...approved, status: 'ACTIVE' as const }],
            pendingApplications: g.pendingApplications?.filter((a) => a.userId !== userId),
          };
        })
      );
    } catch {
      setError("Erreur lors de l'approbation");
    }
  };

  const handleReject = async (groupId: number, userId: number) => {
    try {
      await rejectApplication(groupId, userId);
      setGroups((prev) =>
        prev.map((g) =>
          g.id !== groupId
            ? g
            : { ...g, pendingApplications: g.pendingApplications?.filter((a) => a.userId !== userId) }
        )
      );
    } catch {
      setError('Erreur lors du refus');
    }
  };

  const handleTogglePrivacy = async (group: Group) => {
    try {
      const updated = await updateGroupPrivacy(group.id, !group.isPrivate);
      setGroups((prev) => prev.map((g) => (g.id === group.id ? updated : g)));
      setPublicGroups((prev) =>
        updated.isPrivate
          ? prev.filter((pg) => pg.id !== group.id)
          : prev
      );
    } catch {
      setError('Erreur lors du changement de confidentialité');
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
          g.id !== groupId
            ? g
            : { ...g, members: g.members.filter((m) => m.userId !== userId), memberCount: g.memberCount - 1 }
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="page-title mb-0">👥 Groupes</h1>
        <div className="flex gap-2">
          <button onClick={() => { setShowJoin(true); setShowCreate(false); }} className="btn-secondary text-sm">
            Code d'invitation
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

      {/* Join via code form */}
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
                <button onClick={() => setActiveTab('discover')} className="text-wc-green underline">Découvrir</button>.
              </p>
            </div>
          ) : (
            groups.map((group) => {
              const isGroupAdmin = group.currentUserRole === 'GROUP_ADMIN';
              const pendingCount = group.pendingApplications?.length ?? 0;
              const activeSection = openAdminSection[group.id] ?? null;

              // Forfeits
              const pendingForfeits = groupPendingForfeits[group.id] ?? [];
              const activeForfeits = groupActiveForfeits[group.id] ?? [];

              // Daily gages
              const dailyGages = groupDailyGages[group.id] ?? [];
              const groupForfeitsForPicker = availableForfeits.filter(
                (f) => f.isActive && (!f.groupId || f.groupId === group.id)
              );
              const configuredDates = new Set(dailyGages.map((dg) => dg.matchDate));
              const unconfiguredMatchDays = [
                ...new Set(allMatches.map((m) => m.matchDate.slice(0, 10))),
              ]
                .filter((d) => !configuredDates.has(d))
                .sort();

              return (
                <div key={group.id} className="card space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-black text-gray-900 dark:text-white">{group.name}</h2>
                        {group.isPrivate && (
                          <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded">
                            🔒 Privé
                          </span>
                        )}
                      </div>
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

                  {/* Admin settings */}
                  {isGroupAdmin && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800/40 rounded-lg p-3 space-y-2">
                      <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 uppercase tracking-wide">
                        Paramètres admin
                      </p>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">Groupe privé</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {group.isPrivate
                              ? 'Invisible dans la liste publique, accès par code uniquement'
                              : 'Visible dans la liste — les utilisateurs peuvent postuler'}
                          </p>
                        </div>
                        <button
                          onClick={() => handleTogglePrivacy(group)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            group.isPrivate ? 'bg-wc-green' : 'bg-gray-300 dark:bg-gray-600'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              group.isPrivate ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <div>
                          <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">Paris du groupe</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Ouvrez des matchs aux paris (par compétition)
                          </p>
                        </div>
                        <Link to="/open-betting" className="btn-primary text-xs whitespace-nowrap">
                          🎲 Ouvrir aux paris
                        </Link>
                      </div>

                      {/* Admin section toggle buttons */}
                      <div className="flex gap-2 pt-2 border-t border-yellow-200 dark:border-yellow-800/40">
                        <button
                          onClick={() => toggleAdminSection(group.id, 'forfeits')}
                          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                            activeSection === 'forfeits'
                              ? 'bg-yellow-500 text-white'
                              : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200'
                          }`}
                        >
                          🃏 Gages du groupe
                        </button>
                        <button
                          onClick={() => toggleAdminSection(group.id, 'daily-gages')}
                          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                            activeSection === 'daily-gages'
                              ? 'bg-yellow-500 text-white'
                              : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200'
                          }`}
                        >
                          📅 Gage du Jour
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ===== SECTION: GAGES DU GROUPE ===== */}
                  {isGroupAdmin && activeSection === 'forfeits' && (
                    <div className="space-y-4">

                      {/* Pending proposed forfeits */}
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          ⏳ Gages proposés en attente ({pendingForfeits.length})
                        </h3>
                        {pendingForfeits.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">Aucun gage en attente de validation.</p>
                        ) : (
                          <div className="space-y-2">
                            {pendingForfeits.map((f) => (
                              <div
                                key={f.id}
                                className="flex items-start justify-between bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 rounded-lg px-3 py-2"
                              >
                                <div className="flex-1 min-w-0 mr-3">
                                  <p className="text-sm font-medium text-gray-900 dark:text-white">{f.title}</p>
                                  {f.description && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{f.description}</p>
                                  )}
                                  <p className="text-xs text-gray-400 mt-0.5">
                                    {f.category} · proposé par{' '}
                                    <span className="font-medium">{f.proposedByUsername ?? '—'}</span>
                                  </p>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                  <button
                                    onClick={() => handleApproveForfeits(group.id, f.id)}
                                    className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded hover:bg-green-200 transition-colors"
                                  >
                                    ✓ Valider
                                  </button>
                                  <button
                                    onClick={() => handleRejectGroupForfeit(group.id, f.id)}
                                    className="text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded hover:bg-red-200 transition-colors"
                                  >
                                    ✕ Refuser
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Active group forfeits */}
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          ✅ Gages actifs du groupe ({activeForfeits.length})
                        </h3>
                        {activeForfeits.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">Aucun gage actif dans ce groupe.</p>
                        ) : (
                          <div className="space-y-2">
                            {activeForfeits.map((f) => (
                              <div
                                key={f.id}
                                className="flex items-start justify-between bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2"
                              >
                                <div className="flex-1 min-w-0 mr-3">
                                  <p className="text-sm font-medium text-gray-900 dark:text-white">{f.title}</p>
                                  {f.description && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{f.description}</p>
                                  )}
                                  <p className="text-xs text-gray-400 mt-0.5">
                                    {f.category}
                                    {f.proposedByUsername && (
                                      <> · proposé par <span className="font-medium">{f.proposedByUsername}</span></>
                                    )}
                                  </p>
                                </div>
                                <button
                                  onClick={() => handleDeleteGroupForfeit(group.id, f.id)}
                                  className="text-xs text-red-500 hover:text-red-700 shrink-0"
                                >
                                  🗑️
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ===== SECTION: GAGE DU JOUR ===== */}
                  {isGroupAdmin && activeSection === 'daily-gages' && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">📅 Gage du Jour</h3>

                      {/* Create daily gage form */}
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">+ Créer un gage du jour</p>
                        <form
                          onSubmit={(e) => handleCreateDailyGage(e, group.id)}
                          className="flex flex-wrap gap-2 items-end"
                        >
                          <div>
                            <label className="label text-xs">Date (JJ/MM/AAAA)</label>
                            <input
                              type="text"
                              value={dgDateDisplay[group.id] ?? ''}
                              onChange={(e) => {
                                const display = e.target.value;
                                setDgDateDisplay((prev) => ({ ...prev, [group.id]: display }));
                                setDgDate((prev) => ({ ...prev, [group.id]: parseDDMMYYYY(display) }));
                              }}
                              className="input-field w-32 text-sm"
                              placeholder="JJ/MM/AAAA"
                              maxLength={10}
                              required
                            />
                          </div>
                          <div>
                            <label className="label text-xs">Mode</label>
                            <select
                              value={dgMode[group.id] ?? 'DIRECT'}
                              onChange={(e) =>
                                setDgMode((prev) => ({ ...prev, [group.id]: e.target.value as 'DIRECT' | 'VOTE' }))
                              }
                              className="input-field text-sm"
                            >
                              <option value="DIRECT">🎯 Choix direct</option>
                              <option value="VOTE">🗳️ Vote</option>
                            </select>
                          </div>
                          <button type="submit" className="btn-primary text-sm">Créer</button>
                        </form>
                        {dgError[group.id] && (
                          <p className="text-red-500 text-xs mt-2">{dgError[group.id]}</p>
                        )}
                        {dgSuccess[group.id] && (
                          <p className="text-green-500 text-xs mt-2">✅ {dgSuccess[group.id]}</p>
                        )}
                      </div>

                      {/* Unconfigured match days */}
                      {unconfiguredMatchDays.length > 0 && (
                        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-300 dark:border-amber-700/40 rounded-lg p-3">
                          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-2">
                            ⚠️ Jours de match sans gage ({unconfiguredMatchDays.length})
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {unconfiguredMatchDays.map((date) => (
                              <button
                                key={date}
                                onClick={() => {
                                  setDgDate((prev) => ({ ...prev, [group.id]: date }));
                                  setDgDateDisplay((prev) => ({ ...prev, [group.id]: formatDate(date) }));
                                  setDgMode((prev) => ({ ...prev, [group.id]: 'DIRECT' }));
                                  setDgError((prev) => ({ ...prev, [group.id]: '' }));
                                  setDgSuccess((prev) => ({ ...prev, [group.id]: '' }));
                                }}
                                className="btn-gold text-xs py-0.5 px-2"
                              >
                                📅 {formatDate(date)}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Daily gages list */}
                      {dailyGages.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">Aucun gage du jour configuré pour ce groupe.</p>
                      ) : (
                        <div className="space-y-2">
                          {dailyGages.map((dg) => {
                            const isExpanded = expandedDg[group.id] === dg.id;
                            return (
                              <div key={dg.id} className="bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden">
                                <div
                                  className="flex items-center justify-between px-3 py-2 cursor-pointer"
                                  onClick={() =>
                                    setExpandedDg((prev) => ({
                                      ...prev,
                                      [group.id]: isExpanded ? null : dg.id,
                                    }))
                                  }
                                >
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                      {formatDate(dg.matchDate)}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      {dg.mode === 'DIRECT' ? '🎯 Direct' : '🗳️ Vote'}
                                    </span>
                                    {statusBadge(dg.status)}
                                    {dg.forfeit && (
                                      <span className="text-xs text-wc-green dark:text-green-400 font-medium">
                                        🃏 {dg.forfeit.title}
                                      </span>
                                    )}
                                    {dg.assignedToUsername && (
                                      <span className="text-xs text-wc-red font-medium">
                                        → {dg.assignedToUsername}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-gray-400 text-xs">{isExpanded ? '▲' : '▼'}</span>
                                </div>

                                {isExpanded && dg.status !== 'SETTLED' && (
                                  <div className="px-3 pb-3 border-t border-gray-200 dark:border-gray-700 space-y-2 pt-2">
                                    <div className="flex gap-2 items-center flex-wrap">
                                      <select
                                        value={selectedForfeit[group.id] ?? ''}
                                        onChange={(e) =>
                                          setSelectedForfeit((prev) => ({
                                            ...prev,
                                            [group.id]: Number(e.target.value) || '',
                                          }))
                                        }
                                        className="input-field flex-1 min-w-[160px] text-sm"
                                      >
                                        <option value="">— Choisir un gage —</option>
                                        {groupForfeitsForPicker.map((f) => (
                                          <option key={f.id} value={f.id}>{f.title}</option>
                                        ))}
                                      </select>

                                      {dg.mode === 'DIRECT' ? (
                                        <button
                                          onClick={() => handleSelectDirectly(group.id, dg.id)}
                                          disabled={!selectedForfeit[group.id]}
                                          className="btn-primary text-xs disabled:opacity-50"
                                        >
                                          ✅ Sélectionner
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => handleAddCandidate(group.id, dg.id)}
                                          disabled={!selectedForfeit[group.id]}
                                          className="btn-secondary text-xs disabled:opacity-50"
                                        >
                                          + Candidat
                                        </button>
                                      )}
                                    </div>

                                    {dg.mode === 'VOTE' && dg.candidates.length > 0 && (
                                      <div className="space-y-1">
                                        <p className="text-xs font-semibold text-gray-500 uppercase">Candidats</p>
                                        {dg.candidates.map((c) => (
                                          <div
                                            key={c.id}
                                            className="flex items-center justify-between bg-white dark:bg-gray-700 rounded px-2 py-1"
                                          >
                                            <div>
                                              <span className="text-xs font-medium text-gray-900 dark:text-white">
                                                {c.forfeit.title}
                                              </span>
                                              <span className="ml-2 text-xs text-gray-400">
                                                score : {c.voteScore > 0 ? '+' : ''}{c.voteScore}
                                              </span>
                                            </div>
                                            <button
                                              onClick={() => handleRemoveCandidate(group.id, dg.id, c.forfeit.id)}
                                              className="text-xs text-red-500 hover:text-red-700"
                                            >
                                              ✕
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {isExpanded && dg.status === 'SETTLED' && (
                                  <div className="px-3 pb-3 border-t border-gray-200 dark:border-gray-700 pt-2">
                                    <p className="text-xs text-gray-600 dark:text-gray-400">
                                      🃏 <strong>{dg.forfeit?.title}</strong> attribué à{' '}
                                      <strong className="text-wc-red">{dg.assignedToUsername}</strong>
                                      {dg.assignedAt && (
                                        <span className="ml-1 text-gray-400">le {formatDate(dg.assignedAt)}</span>
                                      )}
                                    </p>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Pending applications (admin only) */}
                  {isGroupAdmin && pendingCount > 0 && (
                    <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/40 rounded-lg p-3 space-y-2">
                      <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide">
                        Candidatures en attente ({pendingCount})
                      </p>
                      {group.pendingApplications!.map((applicant) => (
                        <div key={applicant.id} className="flex items-center justify-between py-1">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-blue-400 text-white flex items-center justify-center text-xs font-bold">
                              {applicant.username[0].toUpperCase()}
                            </div>
                            <span className="text-sm text-gray-800 dark:text-gray-200">{applicant.username}</span>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleApprove(group.id, applicant.userId)}
                              className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                            >
                              ✓ Accepter
                            </button>
                            <button
                              onClick={() => handleReject(group.id, applicant.userId)}
                              className="text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                            >
                              ✕ Refuser
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

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
                        {pg.memberCount} membre{pg.memberCount > 1 ? 's' : ''} · par {pg.createdByUsername}
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
