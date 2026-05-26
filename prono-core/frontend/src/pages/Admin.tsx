import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getMatches, createMatch, updateMatchScore } from '../api/matches';
import { getBets, validateBet, cancelBet } from '../api/bets';
import type { Match, Bet } from '../types';

type AdminTab = 'matches' | 'bets' | 'forfeits';

const Admin: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>('matches');
  const [matches, setMatches] = useState<Match[]>([]);
  const [bets, setBets] = useState<Bet[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Match creation state
  const [newTeamA, setNewTeamA] = useState('');
  const [newTeamB, setNewTeamB] = useState('');
  const [newMatchDate, setNewMatchDate] = useState('');
  const [newRound, setNewRound] = useState('Group Stage');
  const [matchError, setMatchError] = useState('');
  const [matchSuccess, setMatchSuccess] = useState('');

  // Score update state
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [newStatus, setNewStatus] = useState<'UPCOMING' | 'ONGOING' | 'FINISHED'>('FINISHED');

  // Bet validation state
  const [editingBet, setEditingBet] = useState<Bet | null>(null);
  const [winningOption, setWinningOption] = useState('');

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

  const handleCreateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setMatchError('');
    setMatchSuccess('');
    try {
      const newMatch = await createMatch({
        teamA: newTeamA,
        teamB: newTeamB,
        matchDate: new Date(newMatchDate).toISOString(),
        competition: 'FIFA World Cup 2026',
        round: newRound,
      });
      setMatches([...matches, newMatch]);
      setNewTeamA('');
      setNewTeamB('');
      setNewMatchDate('');
      setMatchSuccess('Match créé avec succès !');
    } catch {
      setMatchError('Erreur lors de la création du match');
    }
  };

  const handleUpdateScore = async () => {
    if (!editingMatch) return;
    try {
      const updated = await updateMatchScore(editingMatch.id, {
        scoreA: parseInt(scoreA),
        scoreB: parseInt(scoreB),
        status: newStatus,
      });
      setMatches(matches.map((m) => (m.id === updated.id ? updated : m)));
      setEditingMatch(null);
    } catch {
      alert('Erreur lors de la mise à jour du score');
    }
  };

  const handleValidateBet = async () => {
    if (!editingBet || !winningOption) return;
    try {
      const updated = await validateBet(editingBet.id, winningOption);
      setBets(bets.map((b) => (b.id === updated.id ? updated : b)));
      setEditingBet(null);
      setWinningOption('');
    } catch {
      alert('Erreur lors de la validation du pari');
    }
  };

  const handleCancelBet = async (betId: number) => {
    if (!confirm('Annuler ce pari ?')) return;
    try {
      const updated = await cancelBet(betId);
      setBets(bets.map((b) => (b.id === updated.id ? updated : b)));
    } catch {
      alert('Erreur lors de l\'annulation');
    }
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

      {/* Matches Tab */}
      {activeTab === 'matches' && (
        <div className="space-y-6">
          {/* Create Match */}
          <div className="card">
            <h3 className="font-bold text-gray-900 dark:text-white mb-4">+ Créer un match</h3>
            <form onSubmit={handleCreateMatch} className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Équipe A</label>
                <input
                  type="text"
                  value={newTeamA}
                  onChange={(e) => setNewTeamA(e.target.value)}
                  className="input-field"
                  placeholder="Ex: France"
                  required
                />
              </div>
              <div>
                <label className="label">Équipe B</label>
                <input
                  type="text"
                  value={newTeamB}
                  onChange={(e) => setNewTeamB(e.target.value)}
                  className="input-field"
                  placeholder="Ex: Brésil"
                  required
                />
              </div>
              <div>
                <label className="label">Date & heure</label>
                <input
                  type="datetime-local"
                  value={newMatchDate}
                  onChange={(e) => setNewMatchDate(e.target.value)}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="label">Stade / Tour</label>
                <input
                  type="text"
                  value={newRound}
                  onChange={(e) => setNewRound(e.target.value)}
                  className="input-field"
                  placeholder="Ex: Finale"
                />
              </div>
              {matchError && <p className="col-span-2 text-red-500 text-sm">{matchError}</p>}
              {matchSuccess && <p className="col-span-2 text-green-500 text-sm">✅ {matchSuccess}</p>}
              <div className="col-span-2">
                <button type="submit" className="btn-primary">
                  ⚽ Créer le match
                </button>
              </div>
            </form>
          </div>

          {/* Match List */}
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

      {/* Bets Tab */}
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
                  <button
                    onClick={() => setEditingBet(bet)}
                    className="btn-primary text-xs py-1 px-3"
                  >
                    ✅ Valider
                  </button>
                  <button
                    onClick={() => handleCancelBet(bet.id)}
                    className="btn-danger text-xs py-1 px-3"
                  >
                    ❌ Annuler
                  </button>
                </div>
              </div>
            </div>
          ))}
          {bets.filter((b) => b.status === 'OPEN').length === 0 && (
            <div className="card text-center py-8 text-gray-500">
              Aucun pari ouvert à gérer
            </div>
          )}
        </div>
      )}

      {/* Forfeits Tab */}
      {activeTab === 'forfeits' && (
        <div className="card text-center py-8">
          <div className="text-4xl mb-3">🃏</div>
          <p className="text-gray-600 dark:text-gray-400">
            Gestion des gages — Les gages sont assignés automatiquement lors de la validation des paris de type GAGE.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Utilisez l'API Swagger pour gérer manuellement: POST /api/forfeits/assign
          </p>
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
                <input
                  type="number"
                  value={scoreA}
                  onChange={(e) => setScoreA(e.target.value)}
                  className="input-field w-20 text-center text-xl font-bold"
                  min={0}
                />
              </div>
              <span className="text-2xl font-bold text-gray-400 mt-5">-</span>
              <div>
                <label className="label text-xs">{editingMatch.teamB}</label>
                <input
                  type="number"
                  value={scoreB}
                  onChange={(e) => setScoreB(e.target.value)}
                  className="input-field w-20 text-center text-xl font-bold"
                  min={0}
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="label">Statut</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as 'UPCOMING' | 'ONGOING' | 'FINISHED')}
                className="input-field"
              >
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
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              ✅ Valider le pari
            </h2>
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
