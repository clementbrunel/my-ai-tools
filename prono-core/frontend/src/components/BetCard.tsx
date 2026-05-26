import { useState } from 'react';
import type { Bet, BetParticipation } from '../types';
import { useAuth } from '../context/AuthContext';
import { participate } from '../api/bets';

interface BetCardProps {
  bet: Bet;
  onParticipated?: (participation: BetParticipation) => void;
  showMatch?: boolean;
}

const betTypeLabels: Record<string, string> = {
  SCORE: '⚽ Score',
  EVENT: '🎯 Événement',
  FORFEIT: '🃏 Gage',
  FREE: '💬 Libre',
};

const BetCard: React.FC<BetCardProps> = ({ bet, onParticipated, showMatch = true }) => {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [chosenOption, setChosenOption] = useState('');
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const deadline = new Date(bet.deadline);
  const isExpired = deadline < new Date();

  const handleParticipate = async () => {
    if (!chosenOption.trim()) {
      setError('Veuillez entrer votre pronostic');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      const participation = await participate(bet.id, chosenOption, comment || undefined);
      setShowModal(false);
      setChosenOption('');
      setComment('');
      onParticipated?.(participation);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || 'Erreur lors de la participation');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="card border-2 border-transparent hover:border-wc-green transition-all">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1">
            <h3 className="font-bold text-gray-900 dark:text-white text-sm leading-tight">{bet.title}</h3>
            {showMatch && bet.match && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                ⚽ {bet.match.teamA} vs {bet.match.teamB}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={`badge-${bet.status.toLowerCase()}`}>
              {bet.status === 'OPEN' ? '🟢 Ouvert' : bet.status === 'VALIDATED' ? '✅ Validé' : '❌ Annulé'}
            </span>
            <span className="text-xs text-gray-500">{betTypeLabels[bet.betType]}</span>
          </div>
        </div>

        {bet.description && (
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">{bet.description}</p>
        )}

        {/* Stats */}
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 my-3">
          <span>🏅 {bet.points} points</span>
          <span>👥 {bet.participationsCount} participant{bet.participationsCount !== 1 ? 's' : ''}</span>
          <span>⏰ {deadline.toLocaleDateString('fr-FR')}</span>
        </div>

        {/* Winning option */}
        {bet.status === 'VALIDATED' && bet.winningOption && (
          <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-2 mb-3 text-center">
            <span className="text-xs text-green-700 dark:text-green-300 font-semibold">
              🏆 Réponse gagnante: <strong>{bet.winningOption}</strong>
            </span>
          </div>
        )}

        {/* Creator */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Par {bet.creator.username}
          </span>
          {bet.status === 'OPEN' && !isExpired && user?.id !== bet.creator.id && (
            <button
              onClick={() => setShowModal(true)}
              className="btn-primary text-xs py-1 px-3"
            >
              Parier !
            </button>
          )}
          {isExpired && bet.status === 'OPEN' && (
            <span className="text-xs text-red-500">⏱️ Expiré</span>
          )}
        </div>
      </div>

      {/* Participation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-wc-dark-secondary rounded-xl shadow-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">🎯 {bet.title}</h2>
            {bet.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{bet.description}</p>
            )}
            <div className="mb-4">
              <label className="label">Votre pronostic *</label>
              <input
                type="text"
                value={chosenOption}
                onChange={(e) => setChosenOption(e.target.value)}
                placeholder={bet.betType === 'SCORE' ? 'Ex: 2-1' : 'Votre réponse...'}
                className="input-field"
              />
            </div>
            <div className="mb-4">
              <label className="label">Commentaire (optionnel)</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Votre analyse..."
                className="input-field resize-none"
                rows={2}
              />
            </div>
            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="btn-secondary flex-1"
              >
                Annuler
              </button>
              <button
                onClick={handleParticipate}
                disabled={isSubmitting}
                className="btn-primary flex-1"
              >
                {isSubmitting ? '...' : 'Confirmer 🎯'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BetCard;
