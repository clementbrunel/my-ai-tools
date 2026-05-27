import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getMatches, createMatch, updateMatchScore } from '../api/matches';
import { getBets, validateBet, cancelBet } from '../api/bets';
import {
  getAllForfeitsAdmin,
  createForfeit,
  deleteForfeit,
} from '../api/forfeits';
import {
  getAllDailyGages,
  createDailyGage,
  selectForfeitDirectly,
  addCandidate,
  removeCandidate,
} from '../api/dailyGages';
import type { Match, Bet, Forfeit, DailyGage } from '../types';

type AdminTab = 'matches' | 'bets' | 'forfeits';

const Admin: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>('matches');
  const [matches, setMatches] = useState<Match[]>([]);
  const [bets, setBets] = useState<Bet[]>([]);
  const [forfeits, setForfeits] = useState<Forfeit[]>([]);
  const [dailyGages, setDailyGages] = useState<DailyGage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Match creation
  const [newTeamA, setNewTeamA] = useState('');
  const [newTeamB, setNewTeamB] = useState('');
  const [newMatchDate, setNewMatchDate] = useState('');
  const [newRound, setNewRound] = useState('Group Stage');
  const [matchError, setMatchError] = useState('');
  const [matchSuccess, setMatchSuccess] = useState('');

  // Score update
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [newStatus, setNewStatus] = useState<'UPCOMING' | 'ONGOING' | 'FINISHED'>('FINISHED');

  // Bet validation
  const [editingBet, setEditingBet] = useState<Bet | null>(null);
  const [winningOption, setWinningOption] = useState('');

  // Forfeit library creation
  const [newForfeitTitle, setNewForfeitTitle] = useState('');
  const [newForfeitDesc, setNewForfeitDesc] = useState('');
  const [newForfeitCategory, setNewForfeitCategory] = useState('General');
  const [forfeitError, setForfeitError] = useState('');
  const [forfeitSuccess, setForfeitSuccess] = useState('');

  // Daily gage creation
  const [dgDate, setDgDate] = useState('');
  const [dgMode, setDgMode] = useState<'DIRECT' | 'VOTE'>('DIRECT');
  const [dgError, setDgError] = useState('');
  const [dgSuccess, setDgSuccess] = useState('');

  // Daily gage management (expanded row)
  const [expandedDg, setExpandedDg] = useState<number | null>(null);
  const [selectedForfeitForDg, setSelectedForfeitForDg] = useState<number | ''>('');

  useEffect(() => {
    if (user?.role !== 'ADMIN') {
      navigate('/dashboard');
      return;
    }
    const fetchData = async () => {
      try {
        const [matchesData, betsData] = await Promise.all([getMatches(), getBets()]);
        setMatches(matchesData);
        setBets(betsData);
      } catch (err) {
        console.error('Error loading admin data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [user, navigate]);

  // Lazy-load gages tab data
  useEffect(() => {
    if (activeTab === 'forfeits') {
      Promise.all([getAllForfeitsAdmin(), getAllDailyGages()])
        .then(([f, dg]) => { setForfeits(f); setDailyGages(dg); })
        .catch(console.error);
    }
  }, [activeTab]);

  // ---- Match handlers ----
  const handleCreateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setMatchError(''); setMatchSuccess('');
    try {
      const newMatch = await createMatch({
        teamA: newTeamA, teamB: newTeamB,
        matchDate: new Date(newMatchDate).toISOString(),
        competition: 'FIFA World Cup 2026', round: newRound,
      });
      setMatches([...matches, newMatch]);
      setNewTeamA(''); setNewTeamB(''); setNewMatchDate('');
      setMatchSuccess('Match créé avec succès !');
    } catch { setMatchError('Erreur lors de la création du match'); }
  };

  const handleUpdateScore = async () => {
    if (!editingMatch) return;
    try {
      const updated = await updateMatchScore(editingMatch.id, {
        scoreA: parseInt(scoreA), scoreB: parseInt(scoreB), status: newStatus,
      });
      setMatches(matches.map((m) => (m.id === updated.id ? updated : m)));
      setEditingMatch(null);
    } catch { alert('Erreur lors de la mise à jour du score'); }
  };

  // ---- Bet handlers ----
  const handleValidateBet = async () => {
    if (!editingBet || !winningOption) return;
    try {
      const updated = await validateBet(editingBet.id, winningOption);
      setBets(bets.map((b) => (b.id === updated.id ? updated : b)));
      setEditingBet(null); setWinningOption('');
    } catch { alert('Erreur lors de la validation du pari'); }
  };

  const handleCancelBet = async (betId: number) => {
    if (!confirm('Annuler ce pari ?')) return;
    try {
      const updated = await cancelBet(betId);
      setBets(bets.map((b) => (b.id === updated.id ? updated : b)));
    } catch { alert('Erreur lors de l\'annulation'); }
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

  const handleDeleteForfeit = async (id: number) => {
    if (!confirm('Désactiver ce gage ?')) return;
    try {
      await deleteForfeit(id);
      setForfeits(forfeits.map((f) => f.id === id ? { ...f, isActive: false } : f));
    } catch { alert('Erreur'); }
  };

  // ---- Daily gage handlers ----
  const handleCreateDailyGage = async (e: React.FormEvent) => {
    e.preventDefault();
    setDgError(''); setDgSuccess('');
    try {
      const created = await createDailyGage(dgDate, dgMode);
      setDailyGages([created, ...dailyGages]);
      setDgDate(''); setDgSuccess('Gage du jour créé !');
    } catch { setDgError('Erreur — peut-être un gage existe déjà pour cette date ?'); }
  };

  const handleSelectDirectly = async (dgId: number) => {
    if (!selectedForfeitForDg) return;
    try {
      const updated = await selectForfeitDirectly(dgId, Number(selectedForfeitForDg));
      setDailyGages(dailyGages.map((dg) => dg.id === updated.id ? updated : dg));
      setSelectedForfeitForDg('');
    } catch { alert('Erreur'); }
  };

  const handleAddCandidate = async (dgId: number) => {
    if (!selectedForfeitForDg) return;
    try {
      const updated = await addCandidate(dgId, Number(selectedForfeitForDg));
      setDailyGages(dailyGages.map((dg) => dg.id === updated.id ? updated : dg));
      setSelectedForfeitForDg('');
    } catch { alert('Erreur — ce gage est peut-être déjà candidat ?'); }
  };

  const handleRemoveCandidate = async (dgId: number, forfeitId: number) => {
    try {
      const updated = await removeCandidate(dgId, forfeitId);
      setDailyGages(dailyGages.map((dg) => dg.id === updated.id ? updated : dg));
    } catch { alert('Erreur'); }
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
    { id: 'bets', label: '🎯 Paris' },
    { id: 'forfeits', label: '🃏 Gages' },
  ];

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
                      <td className="py-3 px-4 text-center text-xs text-gray-500">
                        {new Date(match.matchDate).toLocaleDateString('fr-FR')}
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
                            setNewStatus(match.status);
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

      {/* ===== BETS TAB ===== */}
      {activeTab === 'bets' && (
        <div className="space-y-4">
          {bets.filter((b) => b.status === 'OPEN').map((bet) => (
            <div key={bet.id} className="card">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">{bet.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {bet.participationsCount} participants • {bet.points} pts •{' '}
                    {bet.match ? `${bet.match.teamA} vs ${bet.match.teamB}` : 'Sans match'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditingBet(bet)} className="btn-primary text-xs py-1 px-3">
                    ✅ Valider
                  </button>
                  <button onClick={() => handleCancelBet(bet.id)} className="btn-danger text-xs py-1 px-3">
                    ❌ Annuler
                  </button>
                </div>
              </div>
            </div>
          ))}
          {bets.filter((b) => b.status === 'OPEN').length === 0 && (
            <div className="card text-center py-8 text-gray-500">Aucun pari ouvert à gérer</div>
          )}
        </div>
      )}

      {/* ===== FORFEITS TAB ===== */}
      {activeTab === 'forfeits' && (
        <div className="space-y-8">

          {/* --- Section 1: Gage du Jour --- */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">📅 Gage du Jour</h2>

            {/* Create daily gage */}
            <div className="card">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">+ Créer un gage du jour</h3>
              <form onSubmit={handleCreateDailyGage} className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="label">Date</label>
                  <input
                    type="date"
                    value={dgDate}
                    onChange={(e) => setDgDate(e.target.value)}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="label">Mode</label>
                  <select
                    value={dgMode}
                    onChange={(e) => setDgMode(e.target.value as 'DIRECT' | 'VOTE')}
                    className="input-field"
                  >
                    <option value="DIRECT">🎯 Choix direct</option>
                    <option value="VOTE">🗳️ Vote des joueurs</option>
                  </select>
                </div>
                <button type="submit" className="btn-primary">Créer</button>
              </form>
              {dgError && <p className="text-red-500 text-sm mt-2">{dgError}</p>}
              {dgSuccess && <p className="text-green-500 text-sm mt-2">✅ {dgSuccess}</p>}
            </div>

            {/* Daily gages list */}
            {dailyGages.length === 0 ? (
              <div className="card text-center py-6 text-gray-500">Aucun gage du jour configuré</div>
            ) : (
              <div className="space-y-3">
                {dailyGages.map((dg) => (
                  <div key={dg.id} className="card">
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => setExpandedDg(expandedDg === dg.id ? null : dg.id)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {dg.matchDate}
                        </span>
                        <span className="text-xs text-gray-500">
                          {dg.mode === 'DIRECT' ? '🎯 Direct' : '🗳️ Vote'}
                        </span>
                        {statusBadge(dg.status)}
                        {dg.forfeit && (
                          <span className="text-sm text-wc-green dark:text-green-400 font-medium">
                            🃏 {dg.forfeit.title}
                          </span>
                        )}
                        {dg.assignedToUsername && (
                          <span className="text-sm text-wc-red font-medium">
                            → {dg.assignedToUsername}
                          </span>
                        )}
                      </div>
                      <span className="text-gray-400 text-sm">{expandedDg === dg.id ? '▲' : '▼'}</span>
                    </div>

                    {expandedDg === dg.id && dg.status !== 'SETTLED' && (
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
                        {/* Pick a forfeit from the library */}
                        <div className="flex gap-3 items-center flex-wrap">
                          <select
                            value={selectedForfeitForDg}
                            onChange={(e) => setSelectedForfeitForDg(Number(e.target.value) || '')}
                            className="input-field flex-1 min-w-[180px]"
                          >
                            <option value="">— Choisir un gage —</option>
                            {forfeits.filter((f) => f.isActive).map((f) => (
                              <option key={f.id} value={f.id}>{f.title}</option>
                            ))}
                          </select>

                          {dg.mode === 'DIRECT' ? (
                            <button
                              onClick={() => handleSelectDirectly(dg.id)}
                              disabled={!selectedForfeitForDg}
                              className="btn-primary text-sm disabled:opacity-50"
                            >
                              ✅ Sélectionner
                            </button>
                          ) : (
                            <button
                              onClick={() => handleAddCandidate(dg.id)}
                              disabled={!selectedForfeitForDg}
                              className="btn-secondary text-sm disabled:opacity-50"
                            >
                              + Ajouter candidat
                            </button>
                          )}
                        </div>

                        {/* Vote candidates */}
                        {dg.mode === 'VOTE' && dg.candidates.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-gray-500 uppercase">Candidats au vote</p>
                            {dg.candidates.map((c) => (
                              <div key={c.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
                                <div>
                                  <span className="text-sm font-medium text-gray-900 dark:text-white">{c.forfeit.title}</span>
                                  <span className="ml-2 text-xs text-gray-500">
                                    score : {c.voteScore > 0 ? '+' : ''}{c.voteScore}
                                  </span>
                                </div>
                                <button
                                  onClick={() => handleRemoveCandidate(dg.id, c.forfeit.id)}
                                  className="text-xs text-red-500 hover:text-red-700"
                                >
                                  ✕ Retirer
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {expandedDg === dg.id && dg.status === 'SETTLED' && (
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          🃏 <strong>{dg.forfeit?.title}</strong> attribué à{' '}
                          <strong className="text-wc-red">{dg.assignedToUsername}</strong>
                          {dg.assignedAt && (
                            <span className="ml-2 text-xs text-gray-400">
                              le {new Date(dg.assignedAt).toLocaleDateString('fr-FR')}
                            </span>
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* --- Section 2: Bibliotheque de gages --- */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">📚 Bibliothèque de gages</h2>

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

            {/* Forfeit list */}
            <div className="card overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                      <th className="py-3 px-4 text-left text-xs text-gray-500 uppercase">Gage</th>
                      <th className="py-3 px-4 text-left text-xs text-gray-500 uppercase">Catégorie</th>
                      <th className="py-3 px-4 text-center text-xs text-gray-500 uppercase">Effectué</th>
                      <th className="py-3 px-4 text-left text-xs text-gray-500 uppercase">Proposé par</th>
                      <th className="py-3 px-4 text-center text-xs text-gray-500 uppercase">Statut</th>
                      <th className="py-3 px-4 text-center text-xs text-gray-500 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forfeits.map((f) => (
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
                        <td className="py-3 px-4 text-xs text-gray-500">
                          {f.proposedByUsername ? `💡 ${f.proposedByUsername}` : '—'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                            f.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {f.isActive ? 'Actif' : 'Inactif'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {f.isActive && (
                            <button
                              onClick={() => handleDeleteForfeit(f.id)}
                              className="text-xs text-red-500 hover:text-red-700"
                            >
                              🗑️ Supprimer
                            </button>
                          )}
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
            <div className="mb-4">
              <label className="label">Statut</label>
              <select value={newStatus} onChange={(e) => setNewStatus(e.target.value as 'UPCOMING' | 'ONGOING' | 'FINISHED')} className="input-field">
                <option value="UPCOMING">UPCOMING</option>
                <option value="ONGOING">ONGOING</option>
                <option value="FINISHED">FINISHED</option>
              </select>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditingMatch(null)} className="btn-secondary flex-1">Annuler</button>
              <button onClick={handleUpdateScore} className="btn-primary flex-1">Sauvegarder</button>
            </div>
          </div>
        </div>
      )}

      {/* Bet Validation Modal */}
      {editingBet && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-wc-dark-secondary rounded-xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">✅ Valider le pari</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{editingBet.title}</p>
            <div className="mb-4">
              <label className="label">Réponse gagnante *</label>
              <input
                type="text"
                value={winningOption}
                onChange={(e) => setWinningOption(e.target.value)}
                className="input-field"
                placeholder="Ex: 2-1 ou Mbappé"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditingBet(null)} className="btn-secondary flex-1">Annuler</button>
              <button
                onClick={handleValidateBet}
                disabled={!winningOption.trim()}
                className="btn-primary flex-1"
              >
                ✅ Valider
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
