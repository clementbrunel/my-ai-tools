import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { Driver } from '@/types';
import MiniF1Car from '@/components/f1/MiniF1Car';
import { SLOT_META, type SlotKey } from '@/hooks/usePodiumSlots';

interface Props {
  slot: SlotKey;
  driver: Driver | null;
  locked: boolean;
  armed: boolean;
  tall?: boolean;
  onArm: () => void;
  onClear: () => void;
}

/** A droppable prediction slot (P1/P2/P3/pole/meilleur tour/lanterne rouge) — also draggable once filled, to swap with another slot. */
const Slot: React.FC<Props> = ({ slot, driver, locked, armed, tall, onArm, onClear }) => {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${slot}`, data: { slot }, disabled: locked });
  const meta = SLOT_META[slot];
  const dragProps = useDraggable({
    id: `fromslot-${slot}`,
    data: { driverId: driver?.id, fromSlot: slot },
    disabled: locked || !driver,
  });

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        ref={setNodeRef}
        onClick={locked ? undefined : onArm}
        className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all
          ${tall ? 'w-20 h-28 sm:w-24 sm:h-32' : 'w-20 h-24 sm:w-24 sm:h-28'}
          ${locked
            ? 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 opacity-60'
            : isOver
              ? 'border-wc-green bg-green-50 dark:bg-green-900/20 scale-105'
              : armed
                ? 'border-wc-gold bg-yellow-50 dark:bg-yellow-900/20'
                : driver
                  ? 'border-transparent bg-gray-100 dark:bg-gray-800'
                  : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/40 cursor-pointer'}`}
      >
        {driver ? (
          <div
            ref={dragProps.setNodeRef}
            {...dragProps.listeners}
            {...dragProps.attributes}
            className={`flex flex-col items-center ${dragProps.isDragging ? 'opacity-30' : ''} ${locked ? '' : 'cursor-grab active:cursor-grabbing'}`}
          >
            <MiniF1Car color={driver.constructorColor} size={tall ? 52 : 44} />
            <span className="text-xs font-black text-gray-900 dark:text-white">{driver.code}</span>
          </div>
        ) : (
          <span className="text-2xl opacity-40">{meta.icon}</span>
        )}
        {driver && !locked && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 text-[10px] font-bold flex items-center justify-center hover:bg-red-400 hover:text-white"
            aria-label={`Retirer ${driver.code} de ${meta.label}`}
          >
            ✕
          </button>
        )}
        {locked && <span className="absolute -top-2 -right-2 text-sm">🔒</span>}
      </div>
      <span className="text-[10px] font-bold uppercase text-gray-500 dark:text-gray-400 text-center leading-tight">
        {meta.icon} {meta.label}
        <br />
        <span className="text-gray-400 dark:text-gray-500 font-medium">{meta.points}</span>
      </span>
    </div>
  );
};

export default Slot;
