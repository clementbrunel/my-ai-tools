import { useDraggable } from '@dnd-kit/core';
import type { Driver } from '@/types';
import DriverChip from '@/components/f1/DriverChip';

interface Props {
  driver: Driver;
  placedCount: number;
  disabled: boolean;
  onTap: () => void;
}

/** Draggable paddock chip — drag onto a slot, or tap to fill the armed/first eligible one. */
const PaddockDriver: React.FC<Props> = ({ driver, placedCount, disabled, onTap }) => {
  // Placed drivers stay draggable: pole and meilleur tour accept duplicates.
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `paddock-${driver.id}`,
    data: { driverId: driver.id },
    disabled,
  });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={isDragging ? 'opacity-30' : ''}>
      <DriverChip driver={driver} placedCount={placedCount} onClick={disabled ? undefined : onTap} />
    </div>
  );
};

export default PaddockDriver;
