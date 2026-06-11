import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ConfirmModal from '../components/ConfirmModal';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { getMatches, createMatch, updateMatchScore, getCompetitions } from '../api/matches';
import { getAllForfeitsAdmin, createForfeit, updateForfeit, deleteForfeit } from '../api/forfeits';
import { getAllGroups } from '../api/groups';
import { getAllUsersAdmin } from '../api/users';
import { sendTestEmail, type EmailType } from '../api/email';
import DailyGagePanel from '../components/DailyGagePanel';
import type { Match, Forfeit, Group, UserAdminInfo } from '../types';
import { isAdmin } from '../types';
import { formatDate } from '../utils/dates';

type AdminTab = 'matches' | 'forfeits' | 'users' | 'emails';

const Admin: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    variant?: 'danger' | 'default';
    onConfirm: () => void;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>('matches');
  const [matches, setMatches] = useState<Match[]>([]);
  const [forfeits, setForfeits] = useState<Forfeit[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Match creation
  const [competitions, setCompetitions] = useState<string[]>([]);
  const [newTeamA, setNewTeamA] = useState('');
  const [newTeamB, setNewTeamB] = useState('');
  const [newMatchDate, setNewMatchDate] = useState('');
  const [newCompetition, setNewCompetition] = useState('');
  const [isNewCompetition, setIsNewCompetition] = useState(false);
  const [newRound, setNewRound] = useState('Group Stage');
  const [matchError, setMatchError] = useState('');
  const [matchSuccess, setMatchSuccess] = useState('');

  // Score update
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');

  // Forfeit edit
  const [editingForfeit, setEditingForfeit] = useState<Forfeit | null>(null);
  const [editForfeitTitle, setEditForfeitTitle] = useState('');
  const [editForfeitDesc, setEditForfeitDesc] = useState('');
  const [editForfeitCategory, setEditForfeitCategory] = useState('General');

  // Forfeit library
  const [newForfeitTitle, setNewForfeitTitle] = useState('');
  const [newForfeitDesc, setNewForfeitDesc] = useState('');
  const [newForfeitCategory, setNewForfeitCategory] = useState('General');
  const [forfeitError, setForfeitError] = useState('');
  const [forfeitSuccess, setForfeitSuccess] = useState('');

  // Test email form
  const [testEmailTarget, setTestEmailTarget] = useState('');
  const [testEmailType, setTestEmailType] = useState<EmailType>('VERIFICATION');
  const [emailTestLoading, setEmailTestLoading] = useState(false);
  const [emailTestError, setEmailTestError] = useState('');
  const [emailTestSuccess, setEmailTestSuccess] = useState('');

  // Groups the platform admin manages
  const [adminGroups, setAdminGroups] = useState<Group[]>([]);

  // Users tab
  const [platformUsers, setPlatformUsers] = useState<UserAdminInfo[]>([]);
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);

  useEffect(() => {
    if (!isAdmin(user)) {
      navigate('/dashboard');
      return;
    }
    const fetchData = async () => {
      try {
        const matchesData = await getMatches();
        setMatches(matchesData);
      } catch (err) {
        console.error('Error loading admin data:', err);
      } finally {
        setIsLoading(false);
      }
      try {
        const competitionsData = await getCompetitions();
        setCompetitions(competitionsData);
        if (competitionsData.length > 0) setNewCompetition(competitionsData[0]);
        else setIsNewCompetition(true);
      } catch {
        setIsNewCompetition(true);
      }
    };
    fetchData();
  }, [user, navigate]);

  // Lazy-load gages tab data
  useEffect(() => {
    if (activeTab === 'forfeits') {
      Promise.all([getAllForfeitsAdmin(), getAllGroups()])
        .then(([f, groups]) => {
          setForfeits(f);
          setAdminGroups(groups);
        })
        .catch(console.error);
    }
  }, [activeTab]);

  // Lazy-load users tab data
  useEffect(() => {
    if (activeTab === 'users' && platformUsers.length === 0) {
      getAllUsersAdmin()
        .then(setPlatformUsers)
        .catch(console.error);
    }
  }, [activeTab, platformUsers.length]);

  // ---- Match handlers ----
  const handleCreateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setMatchError(''); setMatchSuccess('');
    try {
      const newMatch = await createMatch({
        teamA: newTeamA, teamB: newTeamB,
        matchDate: new Date(newMatchDate).toISOString(),
        competition: newCompetition, round: newRound,
      });
      const updatedCompetitions = competitions.includes(newCompetition)
        ? competitions
        : [...competitions, newCompetition].sort();
      setCompetitions(updatedCompetitions);
      setMatches([...matches, newMatch]);
      setNewTeamA(''); setNewTeamB(''); setNewMatchDate('');
      setIsNewCompetition(false);
      setMatchSuccess('Match créé avec succès !');
    } catch { setMatchError('Erreur lors de la création du match'); }
  };

  const handleUpdateScore = async () => {
    if (!editingMatch) return;
    try {
      const updated = await updateMatchScore(editingMatch.id, {
        scoreA: parseInt(scoreA), scoreB: parseInt(scoreB), status: 'FINISHED',
      });
      setMatches(matches.map((m) => (m.id === updated.id ? updated : m)));
      setEditingMatch(null);
    } catch { showToast('Erreur lors de la mise à jour du score'); }
  };

  // ---- Forfeit library handlers ----
  const handleCreateForfeit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForfeitError(''); setForfeitSuccess('');
    try {
      const created = await createForfeit(newForfeitTitle, newForfeitDesc, newForfeitCategory);
      setForfeits([...forfeits, created]);
      setNewForfeitTitle(''); setNewForfeitDesc(''); setNewForfeitCategory('General');
      setForfeitSuccess('Gage créé !');
    } catch { setForfeitError('Erreur lors de la création'); }
  };

  const handleDeleteForfeit = (id: number) => {
    setConfirmDialog({
      title: 'Désactiver le gage',
      message: 'Êtes-vous sûr de vouloir désactiver ce gage ?',
      confirmLabel: 'Désactiver',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await deleteForfeit(id);
          setForfeits(prev => prev.map((f) => f.id === id ? { ...f, isActive: false } : f));
        } catch { showToast('Erreur'); }
      },
    });
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailTestError(''); setEmailTestSuccess('');
    setEmailTestLoading(true);
    try {
      await sendTestEmail(testEmailTarget, testEmailType);
      setEmailTestSuccess(`Email envoyé à ${testEmailTarget} !`);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Erreur lors de l\'envoi.';
      setEmailTestError(msg);
    } finally {
      setEmailTestLoading(false);
    }
  };

  const handleOpenEditForfeit = (f: Forfeit) => {
    setEditingForfeit(f);
    setEditForfeitTitle(f.title);
    setEditForfeitDesc(f.description);
    setEditForfeitCategory(f.category);
  };

  const handleSaveEditForfeit = async () => {
    if (!editingForfeit) return;
    try {
      const updated = await updateForfeit(editingForfeit.id, editForfeitTitle, editForfeitDesc, editForfeitCategory);
      setForfeits(prev => prev.map((f) => f.id === updated.id ? updated : f));
      setEditingForfeit(null);
      showToast('Gage mis à jour !', 'success');
    } catch { showToast('Erreur lors de la mise à jour'); }
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl">⚙️</div>
        <p className="text-gray-500 mt-3">Chargement...</p>
      </div>
    );
  }

  const tabs: { id: AdminTab; label: string }[] = [
    { id: 'matches', label: '⚽ Matchs' },
    { id: 'forfeits', label: '🃏 Gages' },
    { id: 'users', label: '👥 Utilisateurs' },
    { id: 'emails', label: '📧 Emails' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="page-title mb-0">⚙️ Administration</h1>
        <span className="badge-admin">ADMIN</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-wc-green text-wc-green'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===== MATCHES TAB ===== */}
      {activeTab === 'matches' && (
        <div className="space-y-6">
          <div className="card">
            <h3 className="font-bold text-gray-900 dark:text-white mb-4">+ Créer un match</h3>
            <form onSubmit={handleCreateMatch} className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Équipe A</label>
                <input type="text" value={newTeamA} onChange={(e) => setNewTeamA(e.target.value)}
                  className="input-field" placeholder="Ex: France" required />
              </div>
              <div>
                <label className="label">Équipe B</label>
                <input type="text" value={newTeamB} onChange={(e) => setNewTeamB(e.target.value)}
                  className="input-field" placeholder="Ex: Brésil" required />
              </div>
              <div>
                <label className="label">Date & heure</label>
                <input type="datetime-local" value={newMatchDate} onChange={(e) => setNewMatchDate(e.target.value)}
                  className="input-field" required />
              </div>
              <div>
                <label className="label">Stade / Tour</label>
                <input type="text" value={newRound} onChange={(e) => setNewRound(e.target.value)}
                  className="input-field" placeholder="Ex: Finale" />
              </div>
              <div className="col-span-2">
                <label className="label">Compétition</label>
                {competitions.length > 0 && !isNewCompetition ? (
                  <div className="flex gap-2">
                    <select
                      value={newCompetition}
                      onChange={(e) => {
                        if (e.target.value === '__new__') {
                          setIsNewCompetition(true);
                          setNewCompetition('');
                        } else {
                          setNewCompetition(e.target.value);
                        }
                      }}
                      className="input-field flex-1"
                      required
                    >
                      {competitions.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                      <option value="__new__">➕ Nouvelle compétition...</option>
                    </select>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newCompetition}
                      onChange={(e) => setNewCompetition(e.target.value)}
                      className="input-field flex-1"
                      placeholder="Ex: FIFA World Cup 2026"
                      required
                      autoFocus
                    />
                    {competitions.length > 0 && (
                      <button
                        type="button"
                        onClick={() => { setIsNewCompetition(false); setNewCompetition(competitions[0]); }}
                        className="btn-secondary text-sm whitespace-nowrap"
                      >
                        ← Retour
                      </button>
                    )}
                  </div>
                )}
              </div>
              {matchError && <p className="col-span-2 text-red-500 text-sm">{matchError}</p>}
              {matchSuccess && <p className="col-span-2 text-green-500 text-sm">✅ {matchSuccess}</p>}
              <div className="col-span-2">
                <button type="submit" className="btn-primary">⚽ Créer le match</button>
              </div>
            </form>
          </div>

          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <th className="py-3 px-4 text-left text-xs text-gray-500 uppercase">Match</th>
                    <th className="py-3 px-4 text-left text-xs text-gray-500 uppercase">Compétition</th>
                    <th className="py-3 px-4 text-center text-xs text-gray-500 uppercase">Date</th>
                    <th className="py-3 px-4 text-center text-xs text-gray-500 uppercase">Score</th>
                    <th className="py-3 px-4 text-center text-xs text-gray-500 uppercase">Statut</th>
                    <th className="py-3 px-4 text-center text-xs text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((match) => (
                    <tr key={match.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-3 px-4 text-sm font-medium text-gray-900 dark:text-white">
                        {match.teamA} vs {match.teamB}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-400">
                        {match.competition ?? '-'}
                      </td>
                      <td className="py-3 px-4 text-center text-xs text-gray-500">
                        {formatDate(match.matchDate)}
                      </td>
                      <td className="py-3 px-4 text-center text-sm font-bold text-wc-gold">
                        {match.scoreA !== null && match.scoreA !== undefined ? `${match.scoreA}-${match.scoreB}` : '-'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`badge-${match.status.toLowerCase()} text-xs`}>{match.status}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => {
                            setEditingMatch(match);
                            setScoreA(match.scoreA?.toString() ?? '0');
                            setScoreB(match.scoreB?.toString() ?? '0');
                          }}
                          className="text-xs btn-secondary py-1 px-2"
                        >
                          ✏️ Score
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===== FORFEITS TAB ===== */}
      {activeTab === 'forfeits' && (
        <div className="space-y-8">

          {/* --- Section 1: Gage du Jour --- */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">📅 Gage du Jour</h2>
            {adminGroups.length === 0 ? (
              <div className="card text-center py-6 text-gray-500">
                Vous n'administrez aucun groupe.
              </div>
            ) : (
              adminGroups.map((g) => (
                <div key={g.id} className="card space-y-3">
                  <h3 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                    <span className="text-sm bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full font-medium">
                      👥 {g.name}
                    </span>
                  </h3>
                  <DailyGagePanel groupId={g.id} />
                </div>
              ))
            )}
          </section>

          {/* --- Section 2: Bibliothèque de gages (gages partagés uniquement) --- */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">📚 Bibliothèque de gages</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Ces gages sont partagés entre tous les groupes. Les gages proposés par les joueurs sont gérés par l'admin de leur groupe.
            </p>

            {/* Create forfeit form */}
            <div className="card">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">+ Ajouter un gage</h3>
              <form onSubmit={handleCreateForfeit} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="label">Titre</label>
                  <input
                    type="text"
                    value={newForfeitTitle}
                    onChange={(e) => setNewForfeitTitle(e.target.value)}
                    className="input-field"
                    placeholder="Ex: Croissants pour tout le monde"
                    required
                  />
                </div>
                <div>
                  <label className="label">Description</label>
                  <input
                    type="text"
                    value={newForfeitDesc}
                    onChange={(e) => setNewForfeitDesc(e.target.value)}
                    className="input-field"
                    placeholder="Détail du gage..."
                    required
                  />
                </div>
                <div>
                  <label className="label">Catégorie</label>
                  <select value={newForfeitCategory} onChange={(e) => setNewForfeitCategory(e.target.value)} className="input-field">
                    {['General', 'Nourriture', 'Humiliation', 'Spectacle', 'Réseaux sociaux', 'Boissons'].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                {forfeitError && <p className="col-span-3 text-red-500 text-sm">{forfeitError}</p>}
                {forfeitSuccess && <p className="col-span-3 text-green-500 text-sm">✅ {forfeitSuccess}</p>}
                <div className="md:col-span-3">
                  <button type="submit" className="btn-primary text-sm">🃏 Ajouter le gage</button>
                </div>
              </form>
            </div>

            {/* Forfeit list — shared forfeits only */}
            <div className="card overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                      <th className="py-3 px-4 text-left text-xs text-gray-500 uppercase">Gage</th>
                      <th className="py-3 px-4 text-left text-xs text-gray-500 uppercase">Catégorie</th>
                      <th className="py-3 px-4 text-center text-xs text-gray-500 uppercase">Effectué</th>
                      <th className="py-3 px-4 text-center text-xs text-gray-500 uppercase">Statut</th>
                      <th className="py-3 px-4 text-center text-xs text-gray-500 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forfeits.filter((f) => !f.groupId).map((f) => (
                      <tr
                        key={f.id}
                        className={`border-b border-gray-100 dark:border-gray-700 ${
                          !f.isActive ? 'opacity-40' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                        }`}
                      >
                        <td className="py-3 px-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{f.title}</div>
                          <div className="text-xs text-gray-400 truncate max-w-xs">{f.description}</div>
                        </td>
                        <td className="py-3 px-4 text-xs text-gray-500">{f.category}</td>
                        <td className="py-3 px-4 text-center text-sm font-semibold text-amber-600">
                          {f.timesCompleted > 0 ? `✅ ×${f.timesCompleted}` : '—'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                            f.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {f.isActive ? 'Actif' : 'Inactif'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleOpenEditForfeit(f)}
                              className="text-xs text-indigo-500 hover:text-indigo-700"
                            >
                              ✏️ Éditer
                            </button>
                            {f.isActive && (
                              <button
                                onClick={() => handleDeleteForfeit(f.id)}
                                className="text-xs text-red-500 hover:text-red-700"
                              >
                                🗑️ Supprimer
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ===== USERS TAB ===== */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {platformUsers.length} utilisateur{platformUsers.length !== 1 ? 's' : ''} inscrit{platformUsers.length !== 1 ? 's' : ''}
            </p>
          </div>

          {platformUsers.length === 0 ? (
            <div className="card text-center py-8 text-gray-500">Chargement...</div>
          ) : (
            <div className="card overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                      <th className="py-3 px-4 text-left text-xs text-gray-500 uppercase">Utilisateur</th>
                      <th className="py-3 px-4 text-left text-xs text-gray-500 uppercase">Nom affiché</th>
                      <th className="py-3 px-4 text-left text-xs text-gray-500 uppercase">Email</th>
                      <th className="py-3 px-4 text-center text-xs text-gray-500 uppercase">Rôle</th>
                      <th className="py-3 px-4 text-center text-xs text-gray-500 uppercase">Groupes</th>
                      <th className="py-3 px-4 text-center text-xs text-gray-500 uppercase">Inscrit le</th>
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
                              {expandedUserId === u.id && (
                                <span className="text-xs text-gray-400">▲</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-400">
                            {u.displayName ?? <span className="italic text-gray-300 dark:text-gray-600">—</span>}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-400">{u.email}</td>
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
                        </tr>

                        {expandedUserId === u.id && (
                          <tr className="bg-indigo-50 dark:bg-indigo-900/10 border-b border-indigo-100 dark:border-indigo-800">
                            <td colSpan={6} className="px-6 py-3">
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
          )}
        </div>
      )}

      {/* ===== EMAILS TAB ===== */}
      {activeTab === 'emails' && (
        <div className="space-y-6">
          <div className="card">
            <h3 className="font-bold text-gray-900 dark:text-white mb-1">📧 Tester un template d'email</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Envoie un email de test directement vers une adresse pour prévisualiser le rendu d'un template.
            </p>
            <form onSubmit={handleSendTestEmail} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div>
                <label className="label">Adresse cible</label>
                <input
                  type="email"
                  value={testEmailTarget}
                  onChange={(e) => setTestEmailTarget(e.target.value)}
                  className="input-field"
                  placeholder="test@example.com"
                  required
                />
              </div>
              <div>
                <label className="label">Template</label>
                <select
                  value={testEmailType}
                  onChange={(e) => setTestEmailType(e.target.value as EmailType)}
                  className="input-field"
                >
                  <option value="VERIFICATION">Vérification d'email</option>
                  <option value="PASSWORD_RESET">Réinitialisation de mot de passe</option>
                </select>
              </div>
              <div>
                <button
                  type="submit"
                  className="btn-primary text-sm w-full"
                  disabled={emailTestLoading}
                >
                  {emailTestLoading ? 'Envoi...' : '📤 Envoyer'}
                </button>
              </div>
              {emailTestError && (
                <p className="md:col-span-3 text-red-500 text-sm">{emailTestError}</p>
              )}
              {emailTestSuccess && (
                <p className="md:col-span-3 text-green-500 text-sm">✅ {emailTestSuccess}</p>
              )}
            </form>
          </div>

          <div className="card">
            <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Templates disponibles</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 px-4 text-left text-xs text-gray-500 uppercase">Template</th>
                  <th className="py-2 px-4 text-left text-xs text-gray-500 uppercase">Description</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">Vérification d'email</td>
                  <td className="py-3 px-4 text-gray-500">Envoyé à l'inscription pour vérifier l'adresse email du nouvel utilisateur.</td>
                </tr>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">Réinitialisation de mot de passe</td>
                  <td className="py-3 px-4 text-gray-500">Envoyé lors d'une demande de mot de passe oublié. Contient un lien valable 1 heure.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmDialog !== null}
        title={confirmDialog?.title ?? ''}
        message={confirmDialog?.message ?? ''}
        confirmLabel={confirmDialog?.confirmLabel}
        variant={confirmDialog?.variant}
        onConfirm={() => confirmDialog?.onConfirm()}
        onCancel={() => setConfirmDialog(null)}
      />

      {/* Forfeit Edit Modal */}
      {editingForfeit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-wc-dark-secondary rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              ✏️ Éditer le gage
            </h2>
            <div className="space-y-3 mb-4">
              <div>
                <label className="label">Titre</label>
                <input
                  type="text"
                  value={editForfeitTitle}
                  onChange={(e) => setEditForfeitTitle(e.target.value)}
                  className="input-field"
                  placeholder="Titre du gage"
                />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea
                  value={editForfeitDesc}
                  onChange={(e) => setEditForfeitDesc(e.target.value)}
                  className="input-field resize-none"
                  rows={3}
                  placeholder="Description détaillée du gage..."
                />
              </div>
              <div>
                <label className="label">Catégorie</label>
                <select
                  value={editForfeitCategory}
                  onChange={(e) => setEditForfeitCategory(e.target.value)}
                  className="input-field"
                >
                  {['General', 'Nourriture', 'Humiliation', 'Spectacle', 'Réseaux sociaux', 'Boissons'].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditingForfeit(null)} className="btn-secondary flex-1">Annuler</button>
              <button
                onClick={handleSaveEditForfeit}
                disabled={!editForfeitTitle.trim() || !editForfeitDesc.trim()}
                className="btn-primary flex-1"
              >
                Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Score Update Modal */}
      {editingMatch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-wc-dark-secondary rounded-xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              ✏️ {editingMatch.teamA} vs {editingMatch.teamB}
            </h2>
            <div className="flex items-center gap-3 mb-4">
              <div>
                <label className="label text-xs">{editingMatch.teamA}</label>
                <input type="number" value={scoreA} onChange={(e) => setScoreA(e.target.value)}
                  className="input-field w-20 text-center text-xl font-bold" min={0} />
              </div>
              <span className="text-2xl font-bold text-gray-400 mt-5">-</span>
              <div>
                <label className="label text-xs">{editingMatch.teamB}</label>
                <input type="number" value={scoreB} onChange={(e) => setScoreB(e.target.value)}
                  className="input-field w-20 text-center text-xl font-bold" min={0} />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditingMatch(null)} className="btn-secondary flex-1">Annuler</button>
              <button onClick={handleUpdateScore} className="btn-primary flex-1">Sauvegarder</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Admin;
