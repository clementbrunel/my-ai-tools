import { useState } from 'react';
import type { LeaderboardEntry, UserBetSummary } from '@/types';
import { isAdmin } from '@/types';
import { getUserBetsInGroup } from '@/api/bets';
import UserBetList from './UserBetList';
import Avatar from './Avatar';

interface LeaderboardRowProps {
  entry: LeaderboardEntry;
  isCurrentUser?: boolean;
  groupId: number | null;
}

const rankEmoji: Record<number, string> = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
};

const LeaderboardRow: React.FC<LeaderboardRowProps> = ({ entry, isCurrentUser, groupId }) => {
  const { rank, user, betsWon, totalPoints, forfeitsReceived } = entry;
  const [expanded, setExpanded] = useState(false);
  const [bets, setBets] = useState<UserBetSummary[] | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRowClick = async () => {
    if (!groupId) return;
    if (!expanded && bets === null) {
      setExpanded(true);
      setLoading(true);
      try {
        const data = await getUserBetsInGroup(groupId, user.id);
        setBets(data);
      } catch {
        setBets([]);
      } finally {
        setLoading(false);
      }
    } else {
      setExpanded((v) => !v);
    }
  };

  return (
    <>
      <tr
        onClick={handleRowClick}
        className={`
          border-b border-gray-100 dark:border-gray-700 transition-colors
          ${groupId ? 'cursor-pointer' : ''}
          ${isCurrentUser ? 'bg-green-50 dark:bg-green-900/20 font-semibold' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}
          ${rank === 1 ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}
        `}
      >
        <td className="py-3 px-4">
          {rankEmoji[rank] ? (
            <span className="text-xl">{rankEmoji[rank]}</span>
          ) : (
            <span className="text-gray-600 dark:text-gray-400 font-bold text-sm">#{rank}</span>
          )}
        </td>
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            <Avatar
              src={user.avatarUrl}
              alt={user.username}
              fallbackText={(user.displayName || user.username)[0].toUpperCase()}
              sizeClassName="w-8 h-8"
              containerClassName="bg-wc-green text-white font-bold text-sm"
            />
            <div>
              <span className="text-gray-900 dark:text-white text-sm font-medium">
                {user.displayName || user.username}
              </span>
              {isCurrentUser && (
                <span className="ml-2 text-xs text-wc-green dark:text-green-400">(vous)</span>
              )}
              {isAdmin(user) && (
                <span className="ml-2 badge-admin text-xs">Admin</span>
              )}
            </div>
          </div>
        </td>
        <td className="py-3 px-4 text-center">
          <span className="font-bold text-wc-gold text-lg">{totalPoints}</span>
          <span className="text-xs text-gray-500 ml-1">pts</span>
        </td>
        <td className="py-3 px-4 text-center">
          <span className="text-wc-green dark:text-green-400 font-semibold">{betsWon}</span>
        </td>
        <td className="py-3 px-4 text-center">
          {forfeitsReceived > 0 ? (
            <span className="text-wc-red font-semibold">{forfeitsReceived} 🃏</span>
          ) : (
            <span className="text-gray-400">0</span>
          )}
        </td>
        {groupId && (
          <td className="py-3 px-4 text-center w-8">
            <span className="text-gray-400 text-xs">{expanded ? '▲' : '▼'}</span>
          </td>
        )}
      </tr>

      {expanded && (
        <tr className="border-b border-gray-100 dark:border-gray-700">
          <td colSpan={groupId ? 6 : 5} className="px-4 pb-4 pt-0 bg-gray-50 dark:bg-gray-800/30">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-3">
                <svg className="animate-spin h-4 w-4 text-wc-green" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm text-gray-500">Chargement des paris...</span>
              </div>
            ) : (
              <UserBetList bets={bets ?? []} compact />
            )}
          </td>
        </tr>
      )}
    </>
  );
};

export default LeaderboardRow;
