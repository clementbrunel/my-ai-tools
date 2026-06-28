import React, { useEffect, useState } from 'react';
import { useToast } from '../../components/Toast';
import { getMatches, createMatch, updateMatchScore, forceSettleMatch } from '../../api/matches';
import { getAllCompetitions as fetchAllCompetitions, getCompetitionTeams } from '../../api/competitions';
import { useFormMessages } from '../../hooks/useFormMessages';
import type { Match, MatchPhase } from '../../types';
import { formatDate } from '../../utils/dates';
import ScrollableTableWrapper from '../../components/ScrollableTableWrapper';
import ScoreInput from '../../components/ScoreInput';

const KNOCKOUT_ROUNDS = [
  '1/32 de finale',
  '1/16 de finale',
  '1/8 de finale',
  '1/4 de finale',
  '1/2 finale',
  'Petite finale',
  'Finale',
];

const AdminMatchesTab: React.FC = () => {
  const { showToast } = useToast();
  const { msg: matchMsg, setError: setMatchError, setSuccess: setMatchSuccess, clear: clearMatchMessages } = useFormMessages();

  const [matches, setMatches] = useState<Match[]>([]);
  const [competitions, setCompetitions] = useState<string[]>([]);
  const [competitionTeams, setCompetitionTeams] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [newTeamA, setNewTeamA] = useState('');
  const [newTeamB, setNewTeamB] = useState('');
  const [newMatchDate, setNewMatchDate] = useState('');
  const [newCompetition, setNewCompetition] = useState('');
  const [isNewCompetition, setIsNewCompetition] = useState(false);
  const [newRound, setNewRound] = useState('Phase de poules');
  const [newPhase, setNewPhase] = useState<MatchPhase>('POOL');

  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [penaltyWinner, setPenaltyWinner] = useState('');
  const [penScoreA, setPenScoreA] = useState('');
  const [penScoreB, setPenScoreB] = useState('');
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
        const competitionsData = await fetchAllCompetitions();
        setCompetitions(competitionsData);
        if (competitionsData.length > 0) {
          const first = competitionsData[0];
          setNewCompetition(first);
          const teams = await getCompetitionTeams(first);
          setCompetitionTeams(teams);
        } else {
          setIsNewCompetition(true);
        }
      } catch {
        setIsNewCompetition(true);
      }
    };
    loadData();
  }, []);

  const handleCompetitionChange = async (value: string) => {
    setNewCompetition(value);
    setNewTeamA('');
    setNewTeamB('');
    if (value) {
      try {
        const teams = await getCompetitionTeams(value);
        setCompetitionTeams(teams);
      } catch {
        setCompetitionTeams([]);
      }
    } else {
      setCompetitionTeams([]);
    }
  };

  const handleCreateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMatchMessages();
    try {
      const newMatch = await createMatch({
        teamA: newTeamA, teamB: newTeamB,
        matchDate: new Date(newMatchDate).toISOString(),
        competition: newCompetition, round: newRound,
        phase: newPhase,
      });
      const updatedCompetitions = competitions.includes(newCompetition)
        ? competitions
        : [...competitions, newCompetition].sort();
      setCompetitions(updatedCompetitions);
      setMatches([...matches, newMatch]);
      setNewTeamA(''); setNewTeamB(''); setNewMatchDate('');
      setIsNewCompetition(false);
      setMatchSuccess('Match créé avec succès !');
    } catch { setMatchError('Erreur lors de la création du match'); return; }
    try {
      const teams = await getCompetitionTeams(newCompetition);
      setCompetitionTeams(teams);
    } catch { /* non-critical: list stays as-is */ }
  };

  const handleUpdateScore = async () => {
    if (!editingMatch) return;
    try {
      const updated = await updateMatchScore(editingMatch.id, {
        scoreA: parseInt(scoreA),
        scoreB: parseInt(scoreB),
        status: 'FINISHED',
        penaltyWinner: penaltyWinner ? (penaltyWinner as 'A' | 'B') : undefined,
        penaltyScoreA: penScoreA ? parseInt(penScoreA) : undefined,
        penaltyScoreB: penScoreB ? parseInt(penScoreB) : undefined,
      });
      setMatches(matches.map((m) => (m.id === updated.id ? updated : m)));
      setEditingMatch(null);
      setPenaltyWinner(''); setPenScoreA(''); setPenScoreB('');
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
            {competitionTeams.length > 0 ? (
              <select value={newTeamA} onChange={(e) => setNewTeamA(e.target.value)} className="input-field" required>
                <option value="">-- Choisir --</option>
                {competitionTeams.filter((t) => t !== newTeamB).map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            ) : (
              <p className="text-xs text-amber-500 mt-1">Ajoutez d'abord des équipes dans l'onglet Compétitions.</p>
            )}
          </div>
          <div>
            <label className="label">Équipe B</label>
            {competitionTeams.length > 0 ? (
              <select value={newTeamB} onChange={(e) => setNewTeamB(e.target.value)} className="input-field" required>
                <option value="">-- Choisir --</option>
                {competitionTeams.filter((t) => t !== newTeamA).map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            ) : (
              <p className="text-xs text-amber-500 mt-1">Ajoutez d'abord des équipes dans l'onglet Compétitions.</p>
            )}
          </div>
          <div>
            <label className="label">Date & heure</label>
            <input type="datetime-local" value={newMatchDate} onChange={(e) => setNewMatchDate(e.target.value)}
              className="input-field" required />
          </div>
          <div>
            <label className="label">Phase</label>
            <select
              value={newPhase}
              onChange={(e) => {
                const phase = e.target.value as MatchPhase;
                setNewPhase(phase);
                setNewRound(phase === 'POOL' ? 'Phase de poules' : KNOCKOUT_ROUNDS[0]);
              }}
              className="input-field"
            >
              <option value="POOL">Phase de poules</option>
              <option value="KNOCKOUT">Phase éliminatoire</option>
            </select>
          </div>
          <div>
            <label className="label">Label du tour</label>
            {newPhase === 'KNOCKOUT' ? (
              <select value={newRound} onChange={(e) => setNewRound(e.target.value)} className="input-field">
                {KNOCKOUT_ROUNDS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            ) : (
              <input type="text" value={newRound} onChange={(e) => setNewRound(e.target.value)}
                className="input-field" placeholder="Ex: Phase de poules, Groupe A..." />
            )}
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
                      setCompetitionTeams([]);
                    } else {
                      handleCompetitionChange(e.target.value);
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
                    onClick={() => { setIsNewCompetition(false); handleCompetitionChange(competitions[0]); }}
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
        <ScrollableTableWrapper>
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
                          setPenaltyWinner(match.penaltyWinner ?? '');
                          setPenScoreA(match.penaltyScoreA?.toString() ?? '');
                          setPenScoreB(match.penaltyScoreB?.toString() ?? '');
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
        </ScrollableTableWrapper>
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
                <ScoreInput
                  value={scoreA}
                  onChange={setScoreA}
                  min={0}
                  inputClassName="input-field w-16 text-center text-xl font-bold"
                  compact
                />
              </div>
              <span className="text-2xl font-bold text-gray-400 mt-5">-</span>
              <div>
                <label className="label text-xs">{editingMatch.teamB}</label>
                <ScoreInput
                  value={scoreB}
                  onChange={setScoreB}
                  min={0}
                  inputClassName="input-field w-16 text-center text-xl font-bold"
                  compact
                />
              </div>
            </div>
            {/* Penalty fields — only for KNOCKOUT with equal scores */}
            {editingMatch.phase === 'KNOCKOUT' &&
              scoreA !== '' && scoreB !== '' &&
              parseInt(scoreA) === parseInt(scoreB) && !isNaN(parseInt(scoreA)) && (
              <div className="mb-4 p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 space-y-2">
                <p className="text-xs font-medium text-orange-800 dark:text-orange-300">Tirs au but</p>
                <div>
                  <label className="label text-xs">Vainqueur</label>
                  <select value={penaltyWinner} onChange={(e) => { setPenaltyWinner(e.target.value); if (!e.target.value) { setPenScoreA(''); setPenScoreB(''); } }} className="input-field">
                    <option value="">-- Fin réglementaire (nul) --</option>
                    <option value="A">{editingMatch.teamA}</option>
                    <option value="B">{editingMatch.teamB}</option>
                  </select>
                </div>
                {penaltyWinner && (
                  <div>
                    <label className="label text-xs">Score t.a.b. (optionnel)</label>
                    <div className="flex items-center gap-2">
                      <input type="number" value={penScoreA} onChange={(e) => setPenScoreA(e.target.value)} min={0} className="input-field w-16 text-center" placeholder={editingMatch.teamA} />
                      <span className="text-gray-400">-</span>
                      <input type="number" value={penScoreB} onChange={(e) => setPenScoreB(e.target.value)} min={0} className="input-field w-16 text-center" placeholder={editingMatch.teamB} />
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => { setEditingMatch(null); setPenaltyWinner(''); setPenScoreA(''); setPenScoreB(''); }} className="btn-secondary flex-1">Annuler</button>
              <button onClick={handleUpdateScore} className="btn-primary flex-1">Sauvegarder</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminMatchesTab;
