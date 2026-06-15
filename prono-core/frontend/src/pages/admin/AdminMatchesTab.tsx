import React, { useEffect, useState } from 'react';
import { useToast } from '../../components/Toast';
import { getMatches, createMatch, updateMatchScore, getCompetitions, forceSettleMatch } from '../../api/matches';
import { useFormMessages } from '../../hooks/useFormMessages';
import type { Match } from '../../types';
import { formatDate } from '../../utils/dates';

const AdminMatchesTab: React.FC = () => {
  const { showToast } = useToast();
  const { msg: matchMsg, setError: setMatchError, setSuccess: setMatchSuccess, clear: clearMatchMessages } = useFormMessages();

  const [matches, setMatches] = useState<Match[]>([]);
  const [competitions, setCompetitions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [newTeamA, setNewTeamA] = useState('');
  const [newTeamB, setNewTeamB] = useState('');
  const [newMatchDate, setNewMatchDate] = useState('');
  const [newCompetition, setNewCompetition] = useState('');
  const [isNewCompetition, setIsNewCompetition] = useState(false);
  const [newRound, setNewRound] = useState('Group Stage');

  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [recalculatingMatchId, setRecalculatingMatchId] = useState<number | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const matchesData = await getMatches();
        setMatches(matchesData);
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
    loadData();
  }, []);

  const handleCreateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMatchMessages();
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

  const handleForceSettleMatch = async (matchId: number) => {
    setRecalculatingMatchId(matchId);
    try {
      await forceSettleMatch(matchId);
      showToast('Points recalculés avec succès');
    } catch {
      showToast('Erreur lors du recalcul des points');
    } finally {
      setRecalculatingMatchId(null);
    }
  };

  if (isLoading) {
    return <div className="text-center py-8 text-gray-400">Chargement...</div>;
  }

  return (
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
          {matchMsg?.type === 'error' && <p className="col-span-2 text-red-500 text-sm">{matchMsg.text}</p>}
          {matchMsg?.type === 'success' && <p className="col-span-2 text-green-500 text-sm">✅ {matchMsg.text}</p>}
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
                    <div className="flex items-center justify-center gap-2">
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
                      {match.status === 'FINISHED' && (
                        <button
                          onClick={() => handleForceSettleMatch(match.id)}
                          disabled={recalculatingMatchId === match.id}
                          className="text-xs btn-secondary py-1 px-2 disabled:opacity-50"
                        >
                          {recalculatingMatchId === match.id ? '⏳' : '🔄'} Recalculer
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

export default AdminMatchesTab;
