import type { Match } from '@/types';

type MatchStatus = Match['status'];

const STATUS_META: Record<MatchStatus, { emoji: string; label: string }> = {
  UPCOMING: { emoji: '📅', label: 'À venir' },
  ONGOING: { emoji: '🔴', label: 'En cours' },
  FINISHED: { emoji: '✅', label: 'Terminé' },
};

export const getStatusBadgeText = (status: MatchStatus): string =>
  `${STATUS_META[status].emoji} ${STATUS_META[status].label}`;

// Un match ONGOING (sync live football-data.org) reste "à venir" tant qu'il n'est
// pas FINISHED — sinon il disparaît de l'onglet À venir pendant qu'il se joue.
export const isUpcomingStatus = (status: MatchStatus): boolean => status !== 'FINISHED';
