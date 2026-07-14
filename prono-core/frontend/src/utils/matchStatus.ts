import type { Match } from '../types';

type MatchStatus = Match['status'];

const STATUS_META: Record<MatchStatus, { emoji: string; label: string }> = {
  UPCOMING: { emoji: '📅', label: 'À venir' },
  ONGOING: { emoji: '🔴', label: 'En cours' },
  FINISHED: { emoji: '✅', label: 'Terminé' },
};

export const getStatusEmoji = (status: MatchStatus): string => STATUS_META[status].emoji;

export const getStatusLabel = (status: MatchStatus): string => STATUS_META[status].label;

export const getStatusBadgeText = (status: MatchStatus): string =>
  `${STATUS_META[status].emoji} ${STATUS_META[status].label}`;
