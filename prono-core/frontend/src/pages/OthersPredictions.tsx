import { useAuth } from '@/context/AuthContext';
import type { Bet, BetParticipation } from '@/types';
import { computePoints } from '@/utils/matchCalculations';
import Avatar from '@/components/Avatar';

interface Props {
  bet: Bet;
  participations: BetParticipation[];
  showOthers: boolean;
}

const OthersPredictions: React.FC<Props> = ({ bet, participations, showOthers }) => {
  const { user } = useAuth();

  if (!showOthers) {
    // Before deadline: show count only (no peeking!)
    return (
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
    );
  }

  if (participations.length === 0) return null;

  return (
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
                <Avatar
                  src={p.user.avatarUrl}
                  alt={p.user.displayName || p.user.username}
                  fallbackText={(p.user.displayName || p.user.username)[0].toUpperCase()}
                  sizeClassName="w-8 h-8 flex-shrink-0"
                  containerClassName="bg-wc-gold text-gray-900 font-bold text-sm"
                />
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
                    {pts === 7 ? '🎯 +7 pts' : pts === 5 ? '🏆 +5 pts' : pts === 3 ? '👍 +3 pts' : pts === 2 ? '⚡ +2 pts' : '❌ 0 pt'}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OthersPredictions;
