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
      setLoading(true);
      try {
        const data = await getUserBetsInGroup(groupId, user.id);
        setBets(data);
      } catch {
        setBets([]);
      } finally {
        setLoading(false);
      }
    }
    setExpanded((v) => !v);
  };

  const getResultLabel = (bet: UserBetSummary) => {
    if (bet.betStatus !== 'VALIDATED') return null;
    return bet.pointsEarned > 0
      ? <span className="text-xs font-bold text-wc-green">+{bet.pointsEarned} pts ✓</span>
      : <span className="text-xs font-bold text-wc-red">0 pt ✗</span>;
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
              <p className="text-sm text-gray-500 py-3 text-center">Chargement des paris...</p>
            ) : bets && bets.length === 0 ? (
              <p className="text-sm text-gray-400 py-3 text-center italic">Aucun pari effectué dans ce groupe.</p>
            ) : (
              <div className="flex flex-wrap gap-2 pt-3">
                {bets?.map((bet) => {
                  const isWon = bet.betStatus === 'VALIDATED' && bet.pointsEarned > 0;
                  const isLost = bet.betStatus === 'VALIDATED' && bet.pointsEarned === 0;
                  const isPending = bet.betStatus === 'OPEN';
                  return (
                    <div
                      key={bet.participationId}
                      className={`rounded-lg border px-3 py-2 text-xs flex flex-col gap-1 min-w-[140px] max-w-[200px]
                        ${isWon ? 'border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-700' : ''}
                        ${isLost ? 'border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800' : ''}
                        ${isPending ? 'border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-600' : ''}
                        ${bet.betStatus === 'CANCELLED' ? 'border-gray-200 bg-gray-50 dark:bg-gray-700/30 opacity-60' : ''}
                      `}
                    >
                      <div className="font-semibold text-gray-800 dark:text-gray-100 leading-tight">{bet.betTitle}</div>
                      <div className="text-gray-500 dark:text-gray-400">
                        Choix : <span className="font-medium text-gray-700 dark:text-gray-200">{bet.chosenOption}</span>
                      </div>
                      {bet.betStatus === 'VALIDATED' && bet.winningOption && (
                        <div className="text-gray-500 dark:text-gray-400">
                          Résultat : <span className="font-medium">{bet.winningOption}</span>
                        </div>
                      )}
                      <div className="mt-1">{getResultLabel(bet) ?? (
                        <span className={`text-xs ${bet.betStatus === 'CANCELLED' ? 'text-gray-400' : 'text-amber-500'}`}>
                          {bet.betStatus === 'CANCELLED' ? 'Annulé' : 'En attente'}
                        </span>
                      )}</div>
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
