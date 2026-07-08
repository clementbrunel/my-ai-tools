import { Link } from 'react-router-dom';
import type { Match } from '../types';
import { formatDate, formatTime } from '../utils/dates';
import { getFlagUrl } from '../utils/countryFlags';

interface MatchRowProps {
  match: Match;
  pronoStatus?: 'done' | 'missing';
}

const TeamFlag: React.FC<{ name: string; iso2?: string | null }> = ({ name, iso2 }) => {
  const url = getFlagUrl(iso2);
  return url
    ? <img src={url} alt={name} className="w-5 h-4 object-contain rounded-sm shadow-sm" />
    : <span>🏳️</span>;
};

const MatchRow: React.FC<MatchRowProps> = ({ match, pronoStatus }) => {

  const borderClass =
    pronoStatus === 'done'
      ? 'border-l-emerald-400 dark:border-l-emerald-600'
      : pronoStatus === 'missing'
        ? 'border-l-amber-400 dark:border-l-amber-600'
        : 'border-l-transparent';

  return (
    <Link to={`/foot/matches/${match.id}`}>
      <div
        className={`flex items-center gap-3 px-4 py-3 border-l-4 ${borderClass} bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer`}
      >
        {/* Team A */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <TeamFlag name={match.teamA.name} iso2={match.teamA.iso2} />
          <span className="font-medium text-sm text-gray-900 dark:text-white truncate">
            {match.teamA.name}
          </span>
        </div>

        {/* Score / VS */}
        <div className="w-16 flex justify-center shrink-0">
          {match.status !== 'UPCOMING' ? (
            <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
              {match.scoreA ?? '-'} - {match.scoreB ?? '-'}
            </span>
          ) : (
            <div className="text-center">
              <div className="text-xs font-bold text-gray-400 dark:text-gray-500">VS</div>
              <div className="text-xs text-gray-400 dark:text-gray-500">
                {formatTime(match.matchDate)}
              </div>
            </div>
          )}
        </div>

        {/* Team B */}
        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
          <span className="font-medium text-sm text-gray-900 dark:text-white truncate text-right">
            {match.teamB.name}
          </span>
          <TeamFlag name={match.teamB.name} iso2={match.teamB.iso2} />
        </div>

        {/* Date */}
        <div className="hidden sm:block text-xs text-gray-400 dark:text-gray-500 w-24 text-right shrink-0">
          {formatDate(match.matchDate)}
        </div>

        {/* Prono status */}
        <div className="hidden sm:block w-20 text-right shrink-0">
          {pronoStatus === 'done' && (
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              ✓ Saisi
            </span>
          )}
          {pronoStatus === 'missing' && (
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              ⏰ À saisir
            </span>
          )}
        </div>
      </div>
    </Link>
  );
};

export default MatchRow;
