import type { MatchOutcome } from '@/types';

export const OUTCOME_STYLES: Record<MatchOutcome, { letter: string; singular: string; plural: string; tile: string; dot: string }> = {
  W: { letter: 'V', singular: 'Victoire', plural: 'Victoires', tile: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', dot: 'bg-green-500' },
  D: { letter: 'N', singular: 'Match nul', plural: 'Nuls', tile: 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300', dot: 'bg-gray-400' },
  L: { letter: 'D', singular: 'Défaite', plural: 'Défaites', tile: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', dot: 'bg-wc-red' },
};

interface Props {
  /** Outcomes newest first; renders nothing when absent or empty. */
  outcomes?: MatchOutcome[];
  className?: string;
  /** `compact` shrinks the badges on narrow screens, for tight spots like the match header. */
  compact?: boolean;
}

const FormBadges: React.FC<Props> = ({ outcomes, className = '', compact = false }) => {
  if (!outcomes || outcomes.length === 0) return null;
  return (
    <div className={`flex flex-wrap items-center ${compact ? 'gap-0.5 sm:gap-1.5' : 'gap-1.5'} ${className}`}>
      {outcomes.map((o, i) => (
        <span
          key={i}
          title={OUTCOME_STYLES[o].singular}
          className={`${compact ? 'w-4 h-4 sm:w-6 sm:h-6 text-[9px] sm:text-xs' : 'w-6 h-6 text-xs'} rounded-full flex items-center justify-center font-bold text-white ${OUTCOME_STYLES[o].dot}`}
        >
          {OUTCOME_STYLES[o].letter}
        </span>
      ))}
    </div>
  );
};

export default FormBadges;
