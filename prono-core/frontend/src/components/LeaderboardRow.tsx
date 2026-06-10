import type { LeaderboardEntry } from '../types';
import { isAdmin } from '../types';

interface LeaderboardRowProps {
  entry: LeaderboardEntry;
  isCurrentUser?: boolean;
}

const rankEmoji: Record<number, string> = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
};

const LeaderboardRow: React.FC<LeaderboardRowProps> = ({ entry, isCurrentUser }) => {
  const { rank, user, betsWon, totalPoints, forfeitsReceived } = entry;

  return (
    <tr className={`
      border-b border-gray-100 dark:border-gray-700 transition-colors
      ${isCurrentUser ? 'bg-green-50 dark:bg-green-900/20 font-semibold' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}
      ${rank === 1 ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}
    `}>
      <td className="py-3 px-4">
        {rankEmoji[rank] ? (
          <span className="text-xl">{rankEmoji[rank]}</span>
        ) : (
          <span className="text-gray-600 dark:text-gray-400 font-bold text-sm">#{rank}</span>
        )}
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-wc-green text-white flex items-center justify-center font-bold text-sm">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.username} className="w-8 h-8 rounded-full object-cover" />
            ) : (
              (user.displayName || user.username)[0].toUpperCase()
            )}
          </div>
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
    </tr>
  );
};

export default LeaderboardRow;
