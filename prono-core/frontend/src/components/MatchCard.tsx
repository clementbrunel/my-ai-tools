import { Link } from 'react-router-dom';
import type { Match } from '../types';
import { formatDate } from '../utils/dates';
import { getFlag } from '../utils/countryFlags';

interface MatchCardProps {
  match: Match;
  betCount?: number;
}

const statusEmoji: Record<string, string> = {
  UPCOMING: '📅',
  ONGOING: '🔴',
  FINISHED: '✅',
};

const MatchCard: React.FC<MatchCardProps> = ({ match, betCount = 0 }) => {
  const matchDate = new Date(match.matchDate);

  return (
    <Link to={`/matches/${match.id}`}>
      <div className="card hover:border-wc-green border-2 border-transparent cursor-pointer">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <span className={`badge-${match.status.toLowerCase()}`}>
            {statusEmoji[match.status]} {match.status === 'UPCOMING' ? 'À venir' : match.status === 'ONGOING' ? 'En cours' : 'Terminé'}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">{match.round}</span>
        </div>

        {/* Teams and Score */}
        <div className="flex items-center justify-between gap-2 my-4">
          <div className="flex-1 text-center">
            <div className="text-2xl mb-1">{getFlag(match.teamA)}</div>
            <div className="font-bold text-gray-900 dark:text-white text-sm">{match.teamA}</div>
          </div>

          <div className="flex items-center gap-2">
            {match.status === 'FINISHED' || match.status === 'ONGOING' ? (
              <div className="flex items-center gap-1">
                <span className="score-display text-2xl">{match.scoreA ?? '-'}</span>
                <span className="text-gray-400 text-xl font-bold">-</span>
                <span className="score-display text-2xl">{match.scoreB ?? '-'}</span>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-gray-400 dark:text-gray-500 font-bold text-lg">VS</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(matchDate)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  {matchDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 text-center">
            <div className="text-2xl mb-1">{getFlag(match.teamB)}</div>
            <div className="font-bold text-gray-900 dark:text-white text-sm">{match.teamB}</div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <span className="text-xs text-gray-500 dark:text-gray-400">{match.competition}</span>
          {betCount > 0 && (
            <span className="text-xs text-wc-green dark:text-green-400 font-medium">
              🎯 {betCount} pari{betCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
};

export default MatchCard;
