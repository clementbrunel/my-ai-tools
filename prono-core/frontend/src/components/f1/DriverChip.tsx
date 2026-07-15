import type { Driver } from '@/types';
import MiniF1Car from './MiniF1Car';

interface DriverChipProps {
  driver: Driver;
  /** How many slots the driver currently occupies (0 = none) — pole/meilleur tour allow duplicates. */
  placedCount?: number;
  /** Highlighted when armed for tap-to-place. */
  selected?: boolean;
  size?: number;
  onClick?: () => void;
}

/** A driver card for the paddock: mini car in team colors + code + number. */
const DriverChip: React.FC<DriverChipProps> = ({ driver, placedCount = 0, selected, size = 44, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`relative flex flex-col items-center gap-0.5 rounded-lg px-1.5 py-1.5 border transition-all select-none touch-none
      ${selected
        ? 'border-wc-gold ring-2 ring-wc-gold bg-yellow-50 dark:bg-yellow-900/20'
        : placedCount > 0
          ? 'border-wc-green/60 bg-green-50/50 dark:bg-green-900/10'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-wc-dark-secondary'}
      hover:border-gray-400 dark:hover:border-gray-500 cursor-grab active:cursor-grabbing`}
    aria-label={`${driver.name} (${driver.constructorName})`}
    title={`${driver.name} — ${driver.constructorName}${placedCount > 0 ? ` (utilisé ${placedCount} fois dans ce prono)` : ''}`}
  >
    {placedCount > 0 && (
      <span
        className={`absolute -top-1.5 -right-1.5 min-w-4 h-4 px-0.5 rounded-full text-white text-[9px] font-bold flex items-center justify-center ${
          placedCount > 1 ? 'bg-wc-gold !text-gray-900' : 'bg-wc-green'
        }`}
      >
        {placedCount}
      </span>
    )}
    <MiniF1Car color={driver.constructorColor} size={size} />
    <span className="text-[11px] font-black leading-none text-gray-900 dark:text-white">{driver.code}</span>
    <span className="text-[9px] font-bold leading-none" style={{ color: driver.constructorColor }}>
      #{driver.number}
    </span>
  </button>
);

export default DriverChip;
