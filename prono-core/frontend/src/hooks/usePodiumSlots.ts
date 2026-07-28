import { useMemo, useState } from 'react';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import type { Driver } from '@/types';

export type SlotKey = 'p1' | 'p2' | 'p3' | 'pole' | 'fastestLap' | 'last';
export type Slots = Record<SlotKey, Driver | null>;

export const SLOT_ORDER: SlotKey[] = ['p1', 'p2', 'p3', 'pole', 'fastestLap', 'last'];

/**
 * Slots sharing a domain are mutually exclusive for a same driver
 * (podium + lanterne rouge). Pole and meilleur tour are independent:
 * the same driver can hold them on top of a podium spot.
 */
export const SLOT_DOMAIN: Record<SlotKey, 'result' | 'pole' | 'fastestLap'> = {
  p1: 'result', p2: 'result', p3: 'result', last: 'result',
  pole: 'pole', fastestLap: 'fastestLap',
};

export const SLOT_META: Record<SlotKey, { label: string; icon: string; points: string }> = {
  p1: { label: 'Vainqueur', icon: '🥇', points: '3 pts' },
  p2: { label: '2e', icon: '🥈', points: '2 pts' },
  p3: { label: '3e', icon: '🥉', points: '2 pts' },
  pole: { label: 'Pole', icon: '⏱', points: '2 pts' },
  fastestLap: { label: 'Meilleur tour', icon: '🟣', points: '1 pt' },
  last: { label: 'Lanterne rouge', icon: '🔦', points: '2 pts' },
};

export const emptySlots = (): Slots => ({
  p1: null, p2: null, p3: null, pole: null, fastestLap: null, last: null,
});

/**
 * State and drag & drop handlers behind the "Podium +" prediction board:
 * six slots (P1-P3, pole, meilleur tour, lanterne rouge), tap-to-place or
 * drag-to-place from the paddock, and slot-to-slot swaps.
 */
export const usePodiumSlots = (drivers: Driver[], readOnly: boolean, poleLocked: boolean) => {
  const [slots, setSlots] = useState<Slots>(emptySlots());
  const [armedSlot, setArmedSlot] = useState<SlotKey | null>(null);
  const [draggedDriver, setDraggedDriver] = useState<Driver | null>(null);

  // Times each driver is used across the six picks — shown on the paddock chips.
  const placedCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const driver of Object.values(slots)) {
      if (driver) counts.set(driver.id, (counts.get(driver.id) ?? 0) + 1);
    }
    return counts;
  }, [slots]);

  const isSlotLocked = (slot: SlotKey) => readOnly || (slot === 'pole' && poleLocked);

  const assign = (slot: SlotKey, driver: Driver) => {
    if (isSlotLocked(slot)) return;
    setSlots((prev) => {
      const next = { ...prev };
      // Vacate the driver only within the same conflict domain — the same
      // pilot may hold pole and/or meilleur tour on top of a podium spot.
      for (const key of SLOT_ORDER) {
        if (key !== slot && SLOT_DOMAIN[key] === SLOT_DOMAIN[slot]
            && next[key]?.id === driver.id && !isSlotLocked(key)) {
          next[key] = null;
        }
      }
      next[slot] = driver;
      return next;
    });
    setArmedSlot(null);
  };

  const clearSlot = (slot: SlotKey) => setSlots((s) => ({ ...s, [slot]: null }));

  const toggleArm = (slot: SlotKey) => setArmedSlot((prev) => (prev === slot ? null : slot));

  const handleTapDriver = (driver: Driver) => {
    // Armed slot wins; otherwise fill the first empty slot the driver may take.
    const target = armedSlot ?? SLOT_ORDER.find((key) => {
      if (slots[key] || isSlotLocked(key)) return false;
      if (SLOT_DOMAIN[key] !== 'result') return true;
      return !SLOT_ORDER.some((other) =>
        SLOT_DOMAIN[other] === 'result' && slots[other]?.id === driver.id);
    });
    if (target) assign(target, driver);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const driverId = event.active.data.current?.driverId as number | undefined;
    setDraggedDriver(drivers.find((d) => d.id === driverId) ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggedDriver(null);
    const { active, over } = event;
    if (!over) return;
    const targetSlot = over.data.current?.slot as SlotKey | undefined;
    const driverId = active.data.current?.driverId as number | undefined;
    const fromSlot = active.data.current?.fromSlot as SlotKey | undefined;
    if (!targetSlot || !driverId || isSlotLocked(targetSlot)) return;
    const driver = drivers.find((d) => d.id === driverId);
    if (!driver) return;

    if (fromSlot && fromSlot !== targetSlot) {
      if (isSlotLocked(fromSlot)) return;
      if (SLOT_DOMAIN[fromSlot] === SLOT_DOMAIN[targetSlot]) {
        // Same domain: swap occupants.
        setSlots((prev) => ({ ...prev, [fromSlot]: prev[targetSlot], [targetSlot]: driver }));
        setArmedSlot(null);
      } else {
        // Across domains (podium → pole…): copy, the source keeps its driver.
        assign(targetSlot, driver);
      }
    } else if (!fromSlot) {
      assign(targetSlot, driver);
    }
  };

  return {
    slots, setSlots, armedSlot, toggleArm, draggedDriver, placedCounts,
    isSlotLocked, assign, clearSlot, handleTapDriver, handleDragStart, handleDragEnd,
  };
};
