import { Link } from 'react-router-dom';
import type { Match, TeamSummary } from '@/types';
import { formatDate, formatTime } from '@/utils/dates';
import { getStatusBadgeText } from '@/utils/matchStatus';
import TeamLogo from '@/components/TeamLogo';
import FormBadges from '@/components/FormBadges';

/** Record in this competition before the match ("5V 2N 1D") and, when known, league rank and points. */
const TeamSummaryLabel: React.FC<{ summary?: TeamSummary }> = ({ summary }) => {
  if (!summary) return null;
  const { won, draw, lost, ranking } = summary;
  const hasRecord = won + draw + lost > 0;
  if (!hasRecord && !ranking) return null;
  return (
    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
      {hasRecord && <div>{won}V {draw}N {lost}D</div>}
      {ranking && (
        <div>
          {ranking.rank}
          <sup>{ranking.rank === 1 ? 'er' : 'e'}</sup> · {ranking.points} pts
        </div>
      )}
    </div>
  );
};

interface Props {
  match: Match;
}

const MatchHeader: React.FC<Props> = ({ match }) => {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className={`badge-${match.status.toLowerCase()} mr-2`}>
            {getStatusBadgeText(match.status)}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">{match.round}</span>
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400">{match.competition.name}</span>
      </div>

      {/* Teams & Score */}
      <div className="flex items-center justify-between gap-4 py-6">
        <Link to={`/foot/teams/${match.teamA.id}`} className="flex-1 min-w-0 text-center hover:opacity-80">
          <div className="flex justify-center mb-3">
            <TeamLogo
              name={match.teamA.name}
              iso2={match.teamA.iso2}
              crestUrl={match.teamA.crestUrl}
              className="w-16 h-12 object-contain rounded shadow"
              fallbackClassName="text-5xl"
            />
          </div>
          <div className="text-2xl font-black text-gray-900 dark:text-white hover:underline">{match.teamA.name}</div>
          <TeamSummaryLabel summary={match.teamASummary} />
          <FormBadges outcomes={match.teamASummary?.recent} compact className="justify-center mt-3" />
        </Link>

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
                {formatDate(match.matchDate)}
              </div>
              <div className="text-lg font-bold text-gray-700 dark:text-gray-300">
                {formatTime(match.matchDate)}
              </div>
            </div>
          )}
        </div>

        <Link to={`/foot/teams/${match.teamB.id}`} className="flex-1 min-w-0 text-center hover:opacity-80">
          <div className="flex justify-center mb-3">
            <TeamLogo
              name={match.teamB.name}
              iso2={match.teamB.iso2}
              crestUrl={match.teamB.crestUrl}
              className="w-16 h-12 object-contain rounded shadow"
              fallbackClassName="text-5xl"
            />
          </div>
          <div className="text-2xl font-black text-gray-900 dark:text-white hover:underline">{match.teamB.name}</div>
          <TeamSummaryLabel summary={match.teamBSummary} />
          <FormBadges outcomes={match.teamBSummary?.recent} compact className="justify-center mt-3" />
        </Link>
      </div>
    </div>
  );
};

export default MatchHeader;
