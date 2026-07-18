import { Link } from 'react-router-dom';
import type { Match } from '@/types';
import { formatDate, formatTime } from '@/utils/dates';
import { getFlagUrl } from '@/utils/countryFlags';
import { getStatusBadgeText } from '@/utils/matchStatus';

interface MatchCardProps {
  match: Match;
  pronoStatus?: 'done' | 'missing';
}

const TeamFlag: React.FC<{ name: string; iso2?: string | null; size?: string }> = ({ name, iso2, size = 'w-8 h-6' }) => {
  const url = getFlagUrl(iso2);
  return url
    ? <img src={url} alt={name} className={`${size} object-contain rounded-sm shadow-sm`} />
    : <span className="text-2xl">🏳️</span>;
};

const MatchCard: React.FC<MatchCardProps> = ({ match, pronoStatus }) => {

  const borderClass =
    pronoStatus === 'done'
      ? 'border-emerald-400 dark:border-emerald-600 hover:border-emerald-500'
      : pronoStatus === 'missing'
        ? 'border-amber-400 dark:border-amber-600 hover:border-amber-500'
        : 'border-transparent hover:border-wc-green';

  return (
    <Link to={`/foot/matches/${match.id}`}>
      <div className={`card border-2 cursor-pointer ${borderClass}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <span className={`badge-${match.status.toLowerCase()}`}>
            {getStatusBadgeText(match.status)}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">{match.round}</span>
        </div>

        {/* Teams and Score */}
        <div className="flex items-center justify-between gap-2 my-4">
          <div className="flex-1 text-center">
            <div className="flex justify-center mb-1">
              <TeamFlag name={match.teamA.name} iso2={match.teamA.iso2} />
            </div>
            <div className="font-bold text-gray-900 dark:text-white text-sm">{match.teamA.name}</div>
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
                  {formatDate(match.matchDate)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  {formatTime(match.matchDate)}
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 text-center">
            <div className="flex justify-center mb-1">
              <TeamFlag name={match.teamB.name} iso2={match.teamB.iso2} />
            </div>
            <div className="font-bold text-gray-900 dark:text-white text-sm">{match.teamB.name}</div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-gray-400">{match.competition.name}</span>
          <div className="flex items-center gap-1">
            {match.autoSynced && !match.syncLocked && match.externalLinks?.['API-FOOTBALL'] && (
              <span className="text-xs text-blue-500 dark:text-blue-400" title="Résultat synchronisé automatiquement">🔄 sync</span>
            )}
            {match.syncLocked && (
              <span className="text-xs text-gray-400 dark:text-gray-500" title="Score posé manuellement">✏️ manuel</span>
            )}
            {pronoStatus === 'done' && (
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">✓ Prono saisi</span>
            )}
            {pronoStatus === 'missing' && (
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">⏰ À saisir</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};

export default MatchCard;
