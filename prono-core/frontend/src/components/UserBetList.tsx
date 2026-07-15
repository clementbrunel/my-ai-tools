import { useState } from 'react';
import type { UserBetSummary } from '@/types';
import Pagination from './Pagination';

const PAGE_SIZE = 8;

const isWon = (bet: UserBetSummary) => bet.betStatus === 'VALIDATED' && bet.pointsEarned > 0;
const isLost = (bet: UserBetSummary) => bet.betStatus === 'VALIDATED' && bet.pointsEarned === 0;

interface UserBetListProps {
  bets: UserBetSummary[];
  /** Show bets with status OPEN (future/pending). Default: false (leaderboard behaviour). */
  showOpen?: boolean;
  /** Compact one-line layout (leaderboard) vs card layout (profile). Default: false */
  compact?: boolean;
}

const UserBetList: React.FC<UserBetListProps> = ({ bets, showOpen = false, compact = false }) => {
  const [page, setPage] = useState(1);
  const filtered = showOpen ? bets : bets.filter((b) => b.betStatus !== 'OPEN');
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visible = compact
    ? filtered
    : filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  if (visible.length === 0) {
    return (
      <p className="text-sm text-gray-400 py-3 text-center italic">
        Aucun pari effectué.
      </p>
    );
  }

  if (compact) {
    return (
      <div className="divide-y divide-gray-100 dark:divide-gray-700 pt-1">
        {visible.map((bet) => (
          <div key={bet.participationId} className="flex items-center justify-between py-2 gap-3 text-xs">
            <span className="text-gray-700 dark:text-gray-300 truncate">{bet.betTitle}</span>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-gray-500 dark:text-gray-400">{bet.chosenOption}</span>
              {bet.betStatus === 'VALIDATED' && (
                isWon(bet)
                  ? <span className="font-bold text-wc-green">+{bet.pointsEarned}pts</span>
                  : <span className="font-bold text-wc-red">0pt</span>
              )}
              {isWon(bet) && <span>✓</span>}
              {isLost(bet) && <span>✗</span>}
              {bet.betStatus === 'OPEN' && <span className="text-amber-500">…</span>}
              {bet.betStatus === 'CANCELLED' && <span className="text-gray-400">—</span>}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {visible.map((p) => (
          <div
            key={p.participationId}
            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {p.matchTeamA && p.matchTeamB ? `${p.matchTeamA} – ${p.matchTeamB}` : p.betTitle}
              </div>
              <div className="text-xs text-gray-500 truncate">
                Mon choix :{' '}
                <span className="font-medium text-gray-700 dark:text-gray-300">{p.chosenOption}</span>
                {p.betStatus === 'VALIDATED' && p.winningOption && (
                  <> · Résultat : <span className="font-medium">{p.winningOption}</span></>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end ml-3 shrink-0">
              {p.betStatus === 'VALIDATED' ? (
                <span className={isWon(p) ? 'text-green-600 font-bold text-sm' : 'text-red-500 text-sm'}>
                  {isWon(p) ? `+${p.pointsEarned} pts` : isLost(p) ? '0 pt' : ''}
                </span>
              ) : p.betStatus === 'OPEN' ? (
                <span className="text-xs text-blue-500">En cours</span>
              ) : (
                <span className="text-xs text-gray-400">Annulé</span>
              )}
            </div>
          </div>
        ))}
      </div>
      <Pagination currentPage={safePage} totalPages={totalPages} onPageChange={setPage} />
    </>
  );
};

export default UserBetList;
