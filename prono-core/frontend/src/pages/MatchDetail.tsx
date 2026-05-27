import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getMatch } from '../api/matches';
import { getBetsByMatch, getParticipations, upsertParticipate } from '../api/bets';
import { useAuth } from '../context/AuthContext';
import type { Match, Bet, BetParticipation } from '../types';
import { formatDate, formatDateTime } from '../utils/dates';

// ── helpers ──────────────────────────────────────────────────────────────────

/** Mirror of Java extractResult() for client-side point display */
const extractResult = (option: string): string => {
  if (option.startsWith('Match nul')) return 'Match nul';
  if (option.startsWith('Victoire ')) {
    const lastSpace = option.lastIndexOf(' ');
    if (lastSpace > 0) return option.substring(0, lastSpace);
  }
  return option;
};

/** Mirror of Java computeEarnedPoints() */
const computePoints = (chosen: string, winning: string): number => {
  const c = chosen.trim();
  const w = winning.trim();
  if (c === w) return 5;
  if (extractResult(c) === extractResult(w)) return 3;
  return 0;
};

/**
 * Parse a stored option string back into [scoreA, scoreB] for form pre-fill.
 * Format convention (winner's score always first):
 *   "Victoire {teamA} 2-1" → teamA won 2-1 → [2, 1]
 *   "Victoire {teamB} 1-0" → teamB won 1-0 → [0, 1]
 *   "Match nul 1-1"        → draw          → [1, 1]
 */
const parseOption = (option: string, teamA: string, teamB: string): [string, string] => {
  const m = option.match(/(\d+)-(\d+)$/);
  if (!m) return ['', ''];
  const [, first, second] = m;
  if (option.startsWith('Match nul')) return [first, second];
  if (option.startsWith(`Victoire ${teamA}`)) return [first, second]; // first = teamA score (winner)
  if (option.startsWith(`Victoire ${teamB}`)) return [second, first]; // first = teamB score (winner) → flip
  return ['', ''];
};

// ── component ─────────────────────────────────────────────────────────────────

const MatchDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [match, setMatch] = useState<Match | null>(null);
  const [bet, setBet] = useState<Bet | null>(null);
  const [participations, setParticipations] = useState<BetParticipation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Prediction form state
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [comment, setComment] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveError, setSaveError] = useState('');

  const refreshParticipations = useCallback(async (betId: number) => {
    const parts = await getParticipations(betId);
    setParticipations(parts);
    return parts;
  }, []);

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
        if (betsData.length > 0) {
          const theBet = betsData[0];
          setBet(theBet);
          const parts = await refreshParticipations(theBet.id);
          // Pre-fill form if user already participated
          const myPart = parts.find((p) => p.user.username === user?.username);
          if (myPart) {
            const [sA, sB] = parseOption(myPart.chosenOption, matchData.teamA, matchData.teamB);
            setScoreA(sA);
            setScoreB(sB);
            setComment(myPart.comment || '');
          }
        }
      } catch {
        setError('Match introuvable');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [id, user?.username, refreshParticipations]);

  // ── derived ────────────────────────────────────────────────────────────────

  const computeOption = (): string => {
    if (scoreA === '' || scoreB === '') return '';
    const a = parseInt(scoreA), b = parseInt(scoreB);
    if (isNaN(a) || isNaN(b) || a < 0 || b < 0) return '';
    if (!match) return '';
    if (a > b) return `Victoire ${match.teamA} ${a}-${b}`;
    if (b > a) return `Victoire ${match.teamB} ${b}-${a}`;
    return `Match nul ${a}-${b}`;
  };

  const previewOption = computeOption();
  const isDeadlinePassed = match ? new Date() > new Date(match.matchDate) : false;
  const myParticipation = participations.find((p) => p.user.username === user?.username);
  const alreadyVoted = !!myParticipation;
  const canBet = bet?.status === 'OPEN' && !isDeadlinePassed;
  const showOthers = isDeadlinePassed || (bet?.status !== 'OPEN');

  // ── handlers ──────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bet || !previewOption) return;
    setSaveError('');
    setSaveMsg('');
    setIsSaving(true);
    try {
      await upsertParticipate(bet.id, previewOption, comment || undefined);
      await refreshParticipations(bet.id);
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
            <div className="text-5xl mb-3">🏳️</div>
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
            <div className="text-5xl mb-3">🏳️</div>
            <div className="text-2xl font-black text-gray-900 dark:text-white">{match.teamB}</div>
          </div>
        </div>

        {/* Gage du jour reminder is shown on Dashboard */}
      </div>

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
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={scoreA}
                    onChange={(e) => setScoreA(e.target.value)}
                    className="input-field text-center text-3xl font-black w-full py-3"
                    placeholder="0"
                    required
                  />
                </div>
                <div className="text-3xl font-black text-gray-400 dark:text-gray-500 pb-3">—</div>
                <div className="flex-1 text-center">
                  <label className="label text-sm">{match.teamB}</label>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={scoreB}
                    onChange={(e) => setScoreB(e.target.value)}
                    className="input-field text-center text-3xl font-black w-full py-3"
                    placeholder="0"
                    required
                  />
                </div>
              </div>

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
              <div className="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
                <span>
                  🥇 Score exact → <strong className="text-green-600 dark:text-green-400">+5 pts</strong>
                </span>
                <span>
                  🥈 Bon résultat → <strong className="text-yellow-600 dark:text-yellow-400">+3 pts</strong>
                </span>
                <span>
                  ❌ Raté → <strong>0 pt</strong>
                </span>
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
                        return pts === 5 ? (
                          <span className="font-bold text-green-600 dark:text-green-400">
                            🏆 Score exact ! +5 pts
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
                      {p.user.username[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white text-sm">
                        {p.user.username}{' '}
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
                          pts === 5
                            ? 'text-green-600 dark:text-green-400'
                            : pts === 3
                            ? 'text-yellow-600 dark:text-yellow-400'
                            : 'text-red-500'
                        }`}
                      >
                        {pts === 5 ? '🏆 +5 pts' : pts === 3 ? '👍 +3 pts' : '❌ 0 pt'}
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
