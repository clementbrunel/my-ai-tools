import { useState } from 'react';
import type { LeaderboardEntry, UserBetSummary } from '../types';
import { isAdmin } from '../types';
import { getUserBetsInGroup } from '../api/bets';

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
            ) : bets && bets.length === 0 ? (
              <p className="text-sm text-gray-400 py-3 text-center italic">Aucun pari effectué dans ce groupe.</p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700 pt-1">
                {bets?.map((bet) => {
                  const isWon = bet.betStatus === 'VALIDATED' && bet.pointsEarned > 0;
                  const isLost = bet.betStatus === 'VALIDATED' && bet.pointsEarned === 0;
                  return (
                    <div key={bet.participationId} className="flex items-center justify-between py-2 gap-3 text-xs">
                      <span className="text-gray-700 dark:text-gray-300 truncate">{bet.betTitle}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-gray-500 dark:text-gray-400">{bet.chosenOption}</span>
                        {bet.betStatus === 'VALIDATED' && (
                          isWon
                            ? <span className="font-bold text-wc-green">+{bet.pointsEarned}pts</span>
                            : <span className="font-bold text-wc-red">0pt</span>
                        )}
                        {isWon && <span>✓</span>}
                        {isLost && <span>✗</span>}
                        {bet.betStatus === 'OPEN' && <span className="text-amber-500">…</span>}
                        {bet.betStatus === 'CANCELLED' && <span className="text-gray-400">—</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
};

export default LeaderboardRow;
