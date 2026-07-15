import type { Sport } from '@/context/SportContext';

/**
 * Maps a path in one sport's universe to its equivalent in the other, so
 * switching sport (navbar toggle) keeps the user on the same kind of page
 * instead of always bouncing back to the sport's dashboard.
 * Detail pages (ids don't correspond across sports) fall back to their list.
 */
const FOOT_TO_F1: Record<string, string> = {
  '/foot': '/f1',
  '/foot/matches': '/f1/races',
  '/foot/leaderboard': '/f1/leaderboard',
  '/foot/gages': '/f1/gages',
  '/foot/open-betting': '/f1/open-betting',
};

const F1_TO_FOOT: Record<string, string> = {
  '/f1': '/foot',
  '/f1/races': '/foot/matches',
  '/f1/standings': '/foot',
  '/f1/gages': '/foot/gages',
  '/f1/leaderboard': '/foot/leaderboard',
  '/f1/open-betting': '/foot/open-betting',
  '/f1/bets': '/foot',
};

// Shared pages (e.g. /profile, /groups, /admin) stay as-is — no sport prefix.
export function getEquivalentPath(pathname: string, targetSport: Sport): string {
  if (targetSport === 'f1') {
    if (!pathname.startsWith('/foot')) return pathname;
    if (FOOT_TO_F1[pathname]) return FOOT_TO_F1[pathname];
    if (pathname.startsWith('/foot/matches/')) return '/f1/races';
    if (pathname.startsWith('/foot/teams/')) return '/f1';
    return '/f1';
  }

  if (!pathname.startsWith('/f1')) return pathname;
  if (F1_TO_FOOT[pathname]) return F1_TO_FOOT[pathname];
  if (pathname.startsWith('/f1/races/')) return '/foot/matches';
  return '/foot';
}
