import { Link } from 'react-router-dom';
import type { GroupRankEntry } from '@/api/dashboard';

interface GroupRankTileProps {
  groupRanks: GroupRankEntry[];
  selectedGroupIdx: number;
  onSelectGroupIdx: (idx: number) => void;
  leaderboardPath: string;
}

/** Dashboard stat tile — rank/points for the active group, with a group picker
 * when the user plays in several. Shared between the football and F1 dashboards
 * so the two stay visually identical. */
const GroupRankTile: React.FC<GroupRankTileProps> = ({
  groupRanks,
  selectedGroupIdx,
  onSelectGroupIdx,
  leaderboardPath,
}) => {
  return (
    <Link
      to={
        groupRanks.length === 0
          ? leaderboardPath
          : `${leaderboardPath}?groupId=${(groupRanks[selectedGroupIdx] ?? groupRanks[0]).groupId}`
      }
      className="stat-card sm:col-span-2 block hover:ring-2 hover:ring-wc-green transition-all cursor-pointer"
    >
      {groupRanks.length === 0 ? (
        <div className="text-gray-400 dark:text-gray-500 text-sm">Rejoins un groupe pour voir ton classement</div>
      ) : (() => {
        const gr = groupRanks[selectedGroupIdx] ?? groupRanks[0];
        return (
          <>
            {groupRanks.length > 1 && (
              <div className="mb-3" onClick={(e) => e.preventDefault()}>
                <select
                  value={selectedGroupIdx}
                  onChange={(e) => onSelectGroupIdx(Number(e.target.value))}
                  className="input-field text-sm py-1"
                >
                  {groupRanks.map((g, i) => (
                    <option key={g.groupId} value={i}>{g.groupName}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div>
                <div className="stat-value text-wc-gold">#{gr.rank}<span className="text-base font-normal text-gray-400">/{gr.total}</span></div>
                <div className="stat-label">🏅 Classement{groupRanks.length === 1 ? ` · ${gr.groupName}` : ''}</div>
              </div>
              <div>
                <div className="stat-value">{gr.points}</div>
                <div className="stat-label">⭐ Points</div>
              </div>
            </div>
          </>
        );
      })()}
      <div className="text-xs text-wc-green dark:text-green-400 mt-2">Voir le classement complet →</div>
    </Link>
  );
};

export default GroupRankTile;
