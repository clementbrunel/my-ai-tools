import { useState } from 'react';
import { upsertParticipateByMatch } from '@/api/bets';
import { useAuth } from '@/context/AuthContext';
import { useMatches } from '@/context/MatchesContext';
import { usePredictionForm } from '@/hooks/usePredictionForm';
import type { Bet, BetParticipation, Match } from '@/types';
import { formatDateTime } from '@/utils/dates';
import { computePoints } from '@/utils/matchCalculations';
import ScoreInput from '@/components/ScoreInput';

interface Props {
  match: Match;
  bet: Bet;
  participations: BetParticipation[];
  canBet: boolean;
  refreshParticipations: () => Promise<BetParticipation[]>;
}

const PredictionForm: React.FC<Props> = ({ match, bet, participations, canBet, refreshParticipations }) => {
  const { user } = useAuth();
  const { markParticipated } = useMatches();
  const myParticipation = participations.find((p) => p.user.username === user?.username);
  const alreadyVoted = !!myParticipation;

  const {
    scoreA, setScoreA,
    scoreB, setScoreB,
    knockoutWinner, setKnockoutWinner,
    penScoreWinner, setPenScoreWinner,
    penScoreLoser, setPenScoreLoser,
    comment, setComment,
    isKnockout,
    previewOption,
    showTabOption,
  } = usePredictionForm(match, myParticipation);

  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveError, setSaveError] = useState('');

  const matchDate = new Date(match.matchDate);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!previewOption) return;
    setSaveError('');
    setSaveMsg('');
    setIsSaving(true);
    try {
      await upsertParticipateByMatch(match.id, previewOption, comment || undefined);
      await refreshParticipations();
      markParticipated(match.id);
      setSaveMsg(alreadyVoted ? '✅ Pronostic mis à jour !' : '✅ Pronostic enregistré !');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setSaveError(axiosErr.response?.data?.message || "Erreur lors de l'enregistrement");
    } finally {
      setIsSaving(false);
    }
  };

  return (
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

          {/* KNOCKOUT: winner selection first */}
          {isKnockout && (
            <div>
              <label className="label text-sm">Qui gagne ?</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPenScoreWinner(''); setPenScoreLoser('');
                    if (parseInt(scoreA) === parseInt(scoreB)) { setKnockoutWinner('A'); setScoreA('1'); setScoreB('0'); }
                    else { setKnockoutWinner('A'); setScoreA(scoreB); setScoreB(scoreA); }
                  }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    knockoutWinner === 'A'
                      ? 'bg-wc-green text-white border-wc-green'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                  }`}
                >
                  {match.teamA.name}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPenScoreWinner(''); setPenScoreLoser('');
                    if (parseInt(scoreA) === parseInt(scoreB)) { setKnockoutWinner('B'); setScoreA('0'); setScoreB('1'); }
                    else { setKnockoutWinner('B'); setScoreA(scoreB); setScoreB(scoreA); }
                  }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    knockoutWinner === 'B'
                      ? 'bg-wc-green text-white border-wc-green'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                  }`}
                >
                  {match.teamB.name}
                </button>
              </div>
            </div>
          )}

          {/* Score inputs */}
          <div className="flex items-end gap-4">
            <div className="flex-1 text-center">
              <label className="label text-sm">{match.teamA.name}</label>
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
              <label className="label text-sm">{match.teamB.name}</label>
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
          {!showTabOption && (
            <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
              <span>❌ Raté → <strong>0 pt</strong></span>
              <span>🥈 Bon résultat → <strong className="text-yellow-600 dark:text-yellow-400">+3 pts</strong></span>
              <span>🥇 Score exact → <strong className="text-green-600 dark:text-green-400">+5 pts</strong></span>
            </div>
          )}

          {/* TAB — shown when KNOCKOUT + equal scores */}
          {showTabOption && (
            <div className="rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 p-3 space-y-3">
              <p className="text-sm font-medium text-orange-800 dark:text-orange-300">
                ⚡ Égalité — {knockoutWinner === 'A' ? match.teamA.name : match.teamB.name} gagne aux t.a.b.
              </p>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Score aux t.a.b.</p>
                <div className="flex items-end gap-4">
                  <div className="flex-1 text-center">
                    <input
                      type="number"
                      value={penScoreWinner}
                      onChange={(e) => setPenScoreWinner(e.target.value)}
                      min={0}
                      max={20}
                      className="input-field text-center text-sm w-full py-1.5"
                      placeholder="5"
                    />
                  </div>
                  <div className="text-sm font-black text-gray-400 dark:text-gray-500 pb-2">—</div>
                  <div className="flex-1 text-center">
                    <input
                      type="number"
                      value={penScoreLoser}
                      onChange={(e) => setPenScoreLoser(e.target.value)}
                      min={0}
                      max={20}
                      className="input-field text-center text-sm w-full py-1.5"
                      placeholder="4"
                    />
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
                <span>❌ Mauvais gagnant → <strong>0 pt</strong></span>
                <span>🥈 Bon gagnant → <strong className="text-yellow-600 dark:text-yellow-400">+3 pts</strong></span>
                <span>🥇 Bon gagnant + bon score rég → <strong className="text-orange-500">+5 pts</strong></span>
                <span>⚡ + bon score t.a.b. → <strong className="text-orange-600">+7 pts</strong></span>
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
                    ) : pts === 2 ? (
                      <span className="font-bold text-blue-500 dark:text-blue-400">
                        ⚡ Bon score rég. t.a.b. ! +2 pts
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
  );
};

export default PredictionForm;
