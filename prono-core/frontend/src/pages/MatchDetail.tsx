import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getMatch } from '../api/matches';
import { getBetsByMatch, getParticipationsByMatch, upsertParticipateByMatch } from '../api/bets';
import { getDailyGagesByDate, voteOnCandidate } from '../api/dailyGages';
import { useAuth } from '../context/AuthContext';
import type { Match, Bet, BetParticipation, DailyGage } from '../types';
import { formatDate, formatDateTime } from '../utils/dates';
import { useToast } from '../components/Toast';
import { getFlagUrl } from '../utils/countryFlags';
import { extractResult, computePoints, parseOption } from '../utils/matchCalculations';
import DailyGageCard from '../components/DailyGageCard';
import ScoreInput from '../components/ScoreInput';

// ── component ─────────────────────────────────────────────────────────────────

const MatchDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [match, setMatch] = useState<Match | null>(null);
  const [bet, setBet] = useState<Bet | null>(null);
  const [participations, setParticipations] = useState<BetParticipation[]>([]);
  const [dayGages, setDayGages] = useState<DailyGage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Prediction form state
  const [scoreA, setScoreA] = useState('0');
  const [scoreB, setScoreB] = useState('0');
  const [penaltyTeam, setPenaltyTeam] = useState<'A' | 'B'>('A');
  const [penScoreWinner, setPenScoreWinner] = useState('');
  const [penScoreLoser, setPenScoreLoser] = useState('');
  const [comment, setComment] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveError, setSaveError] = useState('');

  const refreshParticipations = useCallback(async () => {
    if (!id) return [];
    const parts = await getParticipationsByMatch(parseInt(id));
    setParticipations(parts);
    return parts;
  }, [id]);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        const [matchData, betsData] = await Promise.all([
          getMatch(parseInt(id)),
          getBetsByMatch(parseInt(id)),
        ]);
        setMatch(matchData);

        // Load this day's gages across ALL the user's groups (show every gage at stake)
        try {
          setDayGages(await getDailyGagesByDate(matchData.matchDate.slice(0, 10)));
        } catch {
          // No gage for this day — that's fine
        }

        if (betsData.length > 0) {
          setBet(betsData[0]);
          await refreshParticipations();
        }
      } catch {
        setError('Match introuvable');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [id, refreshParticipations]);

  // Pre-fill the prediction form once participations and user are both available.
  // Kept separate so auth resolving after mount doesn't re-trigger the data fetch.
  useEffect(() => {
    if (!match || !user) return;
    const myPart = participations.find((p) => p.user.username === user.username);
    if (!myPart) return;
    const option = myPart.chosenOption;
    const [sA, sB] = parseOption(option, match.teamA, match.teamB);
    setScoreA(sA);
    setScoreB(sB);
    setComment(myPart.comment || '');
    if (option.includes(' t.a.b. ')) {
      setPenaltyTeam(option.startsWith(`Victoire ${match.teamA} t.a.b.`) ? 'A' : 'B');
      const penMatch = option.match(/\((\d+)-(\d+)\)$/);
      if (penMatch) { setPenScoreWinner(penMatch[1]); setPenScoreLoser(penMatch[2]); }
    }
  }, [participations, match, user]);

  // Reset penalty scores when scores are no longer equal
  useEffect(() => {
    const a = parseInt(scoreA), b = parseInt(scoreB);
    if (!isNaN(a) && !isNaN(b) && a !== b) {
      setPenScoreWinner('');
      setPenScoreLoser('');
    }
  }, [scoreA, scoreB]);

  // ── gage vote handler ─────────────────────────────────────────────────────

  const handleVoteGage = async (gageId: number, forfeitId: number, vote: number) => {
    try {
      const updated = await voteOnCandidate(gageId, forfeitId, vote);
      setDayGages((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
    } catch {
      showToast('Erreur lors du vote');
    }
  };

  // ── derived ────────────────────────────────────────────────────────────────

  const isKnockout = match?.phase === 'KNOCKOUT';

  const computeOption = (): string => {
    if (scoreA === '' || scoreB === '') return '';
    const a = parseInt(scoreA), b = parseInt(scoreB);
    if (isNaN(a) || isNaN(b) || a < 0 || b < 0) return '';
    if (!match) return '';
    if (a > b) return `Victoire ${match.teamA} ${a}-${b}`;
    if (b > a) return `Victoire ${match.teamB} ${b}-${a}`;
    if (isKnockout && a === b) {
      const winner = penaltyTeam === 'A' ? match.teamA : match.teamB;
      const penSuffix = penScoreWinner && penScoreLoser ? ` (${penScoreWinner}-${penScoreLoser})` : '';
      return `Victoire ${winner} t.a.b. ${a}-${b}${penSuffix}`;
    }
    return `Match nul ${a}-${b}`;
  };

  const previewOption = computeOption();
  const scoresEqual = scoreA !== '' && scoreB !== '' && parseInt(scoreA) === parseInt(scoreB) && !isNaN(parseInt(scoreA));
  const showTabOption = isKnockout && scoresEqual;
  const isDeadlinePassed = match ? new Date() > new Date(match.matchDate) : false;
  const myParticipation = participations.find((p) => p.user.username === user?.username);
  const alreadyVoted = !!myParticipation;
  const canBet = bet?.status === 'OPEN' && !isDeadlinePassed;
  const showOthers = isDeadlinePassed || (bet?.status !== 'OPEN');

  // ── handlers ──────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !bet || !previewOption) return;
    setSaveError('');
    setSaveMsg('');
    setIsSaving(true);
    try {
      await upsertParticipateByMatch(parseInt(id), previewOption, comment || undefined);
      await refreshParticipations();
      setSaveMsg(alreadyVoted ? '✅ Pronostic mis à jour !' : '✅ Pronostic enregistré !');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setSaveError(axiosErr.response?.data?.message || "Erreur lors de l'enregistrement");
    } finally {
      setIsSaving(false);
    }
  };

  // ── loading / error guards ────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl animate-bounce-slow">⚽</div>
        <p className="text-gray-500 mt-3">Chargement...</p>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="card text-center py-12">
        <div className="text-4xl mb-3">😕</div>
        <p className="text-gray-600 dark:text-gray-400">{error || 'Match introuvable'}</p>
        <Link to="/matches" className="btn-primary mt-4 inline-block">
          Retour aux matchs
        </Link>
      </div>
    );
  }

  const matchDate = new Date(match.matchDate);

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Link to="/matches" className="text-sm text-wc-green dark:text-green-400 hover:underline">
        ← Retour aux matchs
      </Link>

      {/* ── Match header ── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className={`badge-${match.status.toLowerCase()} mr-2`}>
              {match.status === 'UPCOMING'
                ? '📅 À venir'
                : match.status === 'ONGOING'
                ? '🔴 En cours'
                : '✅ Terminé'}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">{match.round}</span>
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400">{match.competition}</span>
        </div>

        {/* Teams & Score */}
        <div className="flex items-center justify-between gap-4 py-6">
          <div className="flex-1 text-center">
            <div className="flex justify-center mb-3">
              {getFlagUrl(match.teamA)
                ? <img src={getFlagUrl(match.teamA)!} alt={match.teamA} className="w-16 h-12 object-contain rounded shadow" />
                : <span className="text-5xl">🏳️</span>}
            </div>
            <div className="text-2xl font-black text-gray-900 dark:text-white">{match.teamA}</div>
          </div>

          <div className="text-center">
            {match.status !== 'UPCOMING' ? (
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-5xl font-black text-wc-gold">{match.scoreA ?? '-'}</span>
                  <span className="text-3xl text-gray-400 font-bold">-</span>
                  <span className="text-5xl font-black text-wc-gold">{match.scoreB ?? '-'}</span>
                </div>
                {match.status === 'ONGOING' && (
                  <div className="mt-2 animate-pulse text-wc-red font-bold">🔴 EN DIRECT</div>
                )}
              </div>
            ) : (
              <div>
                <div className="text-2xl font-bold text-gray-400 dark:text-gray-500">VS</div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  {formatDate(matchDate)}
                </div>
                <div className="text-lg font-bold text-gray-700 dark:text-gray-300">
                  {matchDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 text-center">
            <div className="flex justify-center mb-3">
              {getFlagUrl(match.teamB)
                ? <img src={getFlagUrl(match.teamB)!} alt={match.teamB} className="w-16 h-12 object-contain rounded shadow" />
                : <span className="text-5xl">🏳️</span>}
            </div>
            <div className="text-2xl font-black text-gray-900 dark:text-white">{match.teamB}</div>
          </div>
        </div>

      </div>

      {/* ── Daily gages for this match day — one card per group at stake ── */}
      {dayGages.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">🃏 Gage du jour</h2>
          {dayGages.map((g) => (
            <DailyGageCard key={g.id} gage={g} onVote={handleVoteGage} showGroupName={dayGages.length > 1} />
          ))}
        </div>
      )}

      {/* ── My prediction ── */}
      {bet && (
        <div className="card">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            🎯 Mon pronostic
            {alreadyVoted && (
              <span className="ml-2 text-sm font-normal text-green-600 dark:text-green-400">
                ✓ déposé
              </span>
            )}
          </h2>

          {canBet ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                ⏰ Paris ouverts jusqu'au coup d'envoi — {formatDateTime(matchDate)}
              </p>

              {/* Score inputs */}
              <div className="flex items-end gap-4">
                <div className="flex-1 text-center">
                  <label className="label text-sm">{match.teamA}</label>
                  <ScoreInput
                    value={scoreA}
                    onChange={setScoreA}
                    min={0}
                    max={20}
                    inputClassName="input-field text-center text-xl sm:text-3xl font-black w-full py-2 sm:py-3"
                    placeholder="0"
                    required
                  />
                </div>
                <div className="text-3xl font-black text-gray-400 dark:text-gray-500 pb-3">—</div>
                <div className="flex-1 text-center">
                  <label className="label text-sm">{match.teamB}</label>
                  <ScoreInput
                    value={scoreB}
                    onChange={setScoreB}
                    min={0}
                    max={20}
                    inputClassName="input-field text-center text-xl sm:text-3xl font-black w-full py-2 sm:py-3"
                    placeholder="0"
                    required
                  />
                </div>
              </div>

              {/* TAB — mandatory for KNOCKOUT matches with equal scores */}
              {showTabOption && (
                <div className="rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 p-3 space-y-3">
                  <p className="text-sm font-medium text-orange-800 dark:text-orange-300">⚡ Tirs au but — qui gagne ?</p>
                  <div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPenaltyTeam('A')}
                        className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                          penaltyTeam === 'A'
                            ? 'bg-orange-500 text-white border-orange-500'
                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        {match.teamA}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPenaltyTeam('B')}
                        className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                          penaltyTeam === 'B'
                            ? 'bg-orange-500 text-white border-orange-500'
                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        {match.teamB}
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Score aux t.a.b. <span className="text-orange-500 font-medium">(optionnel — +2 pts si exact)</span>
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={penScoreWinner}
                        onChange={(e) => setPenScoreWinner(e.target.value)}
                        min={0}
                        max={20}
                        className="input-field w-16 text-center"
                        placeholder="5"
                      />
                      <span className="text-gray-400 font-bold">-</span>
                      <input
                        type="number"
                        value={penScoreLoser}
                        onChange={(e) => setPenScoreLoser(e.target.value)}
                        min={0}
                        max={20}
                        className="input-field w-16 text-center"
                        placeholder="4"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Live preview */}
              {previewOption && (
                <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 p-3 text-center">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Pronostic : </span>
                  <span className="font-bold text-blue-800 dark:text-blue-300">{previewOption}</span>
                </div>
              )}

              {/* Comment */}
              <div>
                <label className="label text-sm">Commentaire (optionnel)</label>
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="input-field"
                  placeholder="Tu te sens chaud ce soir ? 🔥"
                  maxLength={200}
                />
              </div>

              {/* Points reminder */}
              <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
                <span>🥇 Score exact → <strong className="text-green-600 dark:text-green-400">+5 pts</strong></span>
                <span>🥈 Bon résultat → <strong className="text-yellow-600 dark:text-yellow-400">+3 pts</strong></span>
                {isKnockout && (
                  <>
                    <span>⚡ Bon gagnant t.a.b. → <strong className="text-orange-500">+5 pts</strong></span>
                    <span>🎯 + bon score t.a.b. → <strong className="text-orange-600">+7 pts</strong></span>
                  </>
                )}
                <span>❌ Raté → <strong>0 pt</strong></span>
              </div>

              {saveMsg && (
                <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 p-3 text-center text-green-700 dark:text-green-300 text-sm font-medium">
                  {saveMsg}
                </div>
              )}
              {saveError && (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-3 text-red-700 dark:text-red-300 text-sm">
                  ⚠️ {saveError}
                </div>
              )}

              <button
                type="submit"
                disabled={isSaving || !previewOption}
                className="btn-primary w-full"
              >
                {isSaving
                  ? '⏳ Enregistrement...'
                  : alreadyVoted
                  ? '✏️ Modifier mon prono'
                  : '🎯 Valider mon prono'}
              </button>
            </form>
          ) : (
            // Deadline passed or bet not open
            <div>
              {myParticipation ? (
                <div className="rounded-lg bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-600 p-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Ton pronostic :</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {myParticipation.chosenOption}
                  </p>
                  {myParticipation.comment && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 italic">
                      "{myParticipation.comment}"
                    </p>
                  )}
                  {bet.status === 'VALIDATED' && bet.winningOption && (
                    <div className="mt-3">
                      {(() => {
                        const pts = computePoints(myParticipation.chosenOption, bet.winningOption);
                        return pts === 7 ? (
                          <span className="font-bold text-orange-600 dark:text-orange-400">
                            🎯 T.a.b. exact ! +7 pts
                          </span>
                        ) : pts === 5 ? (
                          <span className="font-bold text-green-600 dark:text-green-400">
                            🏆 Score exact / bon gagnant t.a.b. ! +5 pts
                          </span>
                        ) : pts === 3 ? (
                          <span className="font-bold text-yellow-600 dark:text-yellow-400">
                            👍 Bon résultat ! +3 pts
                          </span>
                        ) : (
                          <span className="font-bold text-red-500">❌ Raté — 0 pt</span>
                        );
                      })()}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                  <p className="text-3xl mb-2">⏰</p>
                  {bet.status === 'CANCELLED' ? (
                    <p className="text-sm">Pari annulé.</p>
                  ) : (
                    <>
                      <p className="text-sm font-medium">Le match a commencé — les paris sont fermés.</p>
                      <p className="text-xs mt-1 text-gray-400">Tu n'as pas participé à ce pari.</p>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── All predictions (revealed after deadline) ── */}
      {bet && showOthers && participations.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
            👥 Pronostics ({participations.length})
          </h2>
          {bet.status === 'VALIDATED' && bet.winningOption && (
            <p className="text-sm text-green-600 dark:text-green-400 font-medium mb-4">
              🏆 Résultat officiel : {bet.winningOption}
            </p>
          )}

          <div className="space-y-2 mt-3">
            {participations.map((p) => {
              const isMe = p.user.username === user?.username;
              const pts =
                bet.status === 'VALIDATED' && bet.winningOption
                  ? computePoints(p.chosenOption, bet.winningOption)
                  : null;
              return (
                <div
                  key={p.id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    isMe
                      ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700'
                      : 'bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-wc-gold text-gray-900 flex items-center justify-center font-bold text-sm flex-shrink-0">
                      {(p.user.displayName || p.user.username)[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white text-sm">
                        {p.user.displayName || p.user.username}{' '}
                        {isMe && (
                          <span className="text-blue-500 text-xs font-normal">(moi)</span>
                        )}
                      </p>
                      {p.comment && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 italic truncate">
                          "{p.comment}"
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right ml-3 flex-shrink-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      {p.chosenOption}
                    </p>
                    {pts !== null && (
                      <p
                        className={`text-xs font-bold ${
                          pts === 7
                            ? 'text-orange-600 dark:text-orange-400'
                            : pts === 5
                            ? 'text-green-600 dark:text-green-400'
                            : pts === 3
                            ? 'text-yellow-600 dark:text-yellow-400'
                            : 'text-red-500'
                        }`}
                      >
                        {pts === 7 ? '🎯 +7 pts' : pts === 5 ? '🏆 +5 pts' : pts === 3 ? '👍 +3 pts' : '❌ 0 pt'}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Before deadline: show count only (no peeking!) */}
      {bet && !showOthers && (
        <div className="card text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
          <p>
            🔒{' '}
            <strong>
              {participations.length} pronostic
              {participations.length !== 1 ? 's' : ''}
            </strong>{' '}
            déposé{participations.length !== 1 ? 's' : ''}
          </p>
          <p className="text-xs mt-1 text-gray-400">
            Les pronos seront révélés au coup d'envoi
          </p>
        </div>
      )}
    </div>
  );
};

export default MatchDetail;
