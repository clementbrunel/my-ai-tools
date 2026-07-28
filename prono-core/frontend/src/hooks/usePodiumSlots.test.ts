import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import type { Driver } from '@/types';
import { usePodiumSlots } from './usePodiumSlots';

const driver = (id: number, code: string): Driver => ({
  id, code, name: code, number: id, constructorId: 1, constructorName: 'Team', constructorColor: '#000',
});

const hamilton = driver(1, 'HAM');
const verstappen = driver(2, 'VER');
const leclerc = driver(3, 'LEC');
const drivers = [hamilton, verstappen, leclerc];

const dragStart = (driverId: number): DragStartEvent =>
  ({ active: { data: { current: { driverId } } } }) as unknown as DragStartEvent;

const dropOnSlot = (driverId: number, slot: string, fromSlot?: string): DragEndEvent =>
  ({
    active: { data: { current: { driverId, fromSlot } } },
    over: { data: { current: { slot } } },
  }) as unknown as DragEndEvent;

describe('usePodiumSlots', () => {
  it('starts empty', () => {
    const { result } = renderHook(() => usePodiumSlots(drivers, false, false));
    expect(result.current.slots).toEqual({
      p1: null, p2: null, p3: null, pole: null, fastestLap: null, last: null,
    });
    expect(result.current.armedSlot).toBeNull();
    expect(result.current.draggedDriver).toBeNull();
    expect(result.current.placedCounts.size).toBe(0);
  });

  it('assign fills a slot and disarms it', () => {
    const { result } = renderHook(() => usePodiumSlots(drivers, false, false));
    act(() => result.current.toggleArm('p1'));
    act(() => result.current.assign('p1', hamilton));
    expect(result.current.slots.p1).toEqual(hamilton);
    expect(result.current.armedSlot).toBeNull();
    expect(result.current.placedCounts.get(hamilton.id)).toBe(1);
  });

  it('assign vacates the driver from another slot in the same domain', () => {
    const { result } = renderHook(() => usePodiumSlots(drivers, false, false));
    act(() => result.current.assign('p2', hamilton));
    act(() => result.current.assign('p1', hamilton));
    expect(result.current.slots.p1).toEqual(hamilton);
    expect(result.current.slots.p2).toBeNull();
  });

  it('lets the same driver hold pole and/or fastest lap on top of a podium spot', () => {
    const { result } = renderHook(() => usePodiumSlots(drivers, false, false));
    act(() => result.current.assign('p1', hamilton));
    act(() => result.current.assign('pole', hamilton));
    act(() => result.current.assign('fastestLap', hamilton));
    expect(result.current.slots.p1).toEqual(hamilton);
    expect(result.current.slots.pole).toEqual(hamilton);
    expect(result.current.slots.fastestLap).toEqual(hamilton);
    expect(result.current.placedCounts.get(hamilton.id)).toBe(3);
  });

  it('clearSlot empties a single slot', () => {
    const { result } = renderHook(() => usePodiumSlots(drivers, false, false));
    act(() => result.current.assign('p1', hamilton));
    act(() => result.current.clearSlot('p1'));
    expect(result.current.slots.p1).toBeNull();
  });

  it('toggleArm arms then disarms the same slot', () => {
    const { result } = renderHook(() => usePodiumSlots(drivers, false, false));
    act(() => result.current.toggleArm('p3'));
    expect(result.current.armedSlot).toBe('p3');
    act(() => result.current.toggleArm('p3'));
    expect(result.current.armedSlot).toBeNull();
  });

  it('handleTapDriver fills the armed slot regardless of slot order', () => {
    const { result } = renderHook(() => usePodiumSlots(drivers, false, false));
    act(() => result.current.toggleArm('last'));
    act(() => result.current.handleTapDriver(leclerc));
    expect(result.current.slots.last).toEqual(leclerc);
    expect(result.current.slots.p1).toBeNull();
  });

  it('handleTapDriver falls back to the first empty eligible slot when nothing is armed', () => {
    const { result } = renderHook(() => usePodiumSlots(drivers, false, false));
    act(() => result.current.handleTapDriver(hamilton));
    expect(result.current.slots.p1).toEqual(hamilton);
    act(() => result.current.handleTapDriver(verstappen));
    expect(result.current.slots.p2).toEqual(verstappen);
  });

  it('handleTapDriver skips domains the driver already holds and locked slots', () => {
    const { result } = renderHook(() => usePodiumSlots(drivers, false, true));
    act(() => result.current.assign('p1', hamilton));
    act(() => result.current.handleTapDriver(hamilton));
    // hamilton already holds the 'result' domain (p1) so p2/p3/last are out,
    // and pole is locked — the next eligible slot is fastestLap.
    expect(result.current.slots.fastestLap).toEqual(hamilton);
    expect(result.current.slots.p2).toBeNull();
    expect(result.current.slots.pole).toBeNull();
  });

  it('isSlotLocked: readOnly locks every slot', () => {
    const { result } = renderHook(() => usePodiumSlots(drivers, true, false));
    expect(result.current.isSlotLocked('p1')).toBe(true);
    expect(result.current.isSlotLocked('pole')).toBe(true);
    act(() => result.current.assign('p1', hamilton));
    expect(result.current.slots.p1).toBeNull();
  });

  it('isSlotLocked: poleLocked only locks the pole slot', () => {
    const { result } = renderHook(() => usePodiumSlots(drivers, false, true));
    expect(result.current.isSlotLocked('pole')).toBe(true);
    expect(result.current.isSlotLocked('p1')).toBe(false);
    act(() => result.current.assign('pole', hamilton));
    expect(result.current.slots.pole).toBeNull();
  });

  it('handleDragStart resolves the dragged driver by id', () => {
    const { result } = renderHook(() => usePodiumSlots(drivers, false, false));
    act(() => result.current.handleDragStart(dragStart(verstappen.id)));
    expect(result.current.draggedDriver).toEqual(verstappen);
  });

  it('handleDragEnd drops a paddock driver onto an empty slot', () => {
    const { result } = renderHook(() => usePodiumSlots(drivers, false, false));
    act(() => result.current.handleDragStart(dragStart(hamilton.id)));
    act(() => result.current.handleDragEnd(dropOnSlot(hamilton.id, 'p1')));
    expect(result.current.slots.p1).toEqual(hamilton);
    expect(result.current.draggedDriver).toBeNull();
  });

  it('handleDragEnd swaps two slots in the same domain', () => {
    const { result } = renderHook(() => usePodiumSlots(drivers, false, false));
    act(() => result.current.assign('p1', hamilton));
    act(() => result.current.assign('p2', verstappen));
    act(() => result.current.handleDragEnd(dropOnSlot(hamilton.id, 'p2', 'p1')));
    expect(result.current.slots.p1).toEqual(verstappen);
    expect(result.current.slots.p2).toEqual(hamilton);
  });

  it('handleDragEnd copies across domains, keeping the source slot', () => {
    const { result } = renderHook(() => usePodiumSlots(drivers, false, false));
    act(() => result.current.assign('p1', hamilton));
    act(() => result.current.handleDragEnd(dropOnSlot(hamilton.id, 'pole', 'p1')));
    expect(result.current.slots.p1).toEqual(hamilton);
    expect(result.current.slots.pole).toEqual(hamilton);
  });

  it('handleDragEnd ignores a drop onto a locked slot', () => {
    const { result } = renderHook(() => usePodiumSlots(drivers, false, true));
    act(() => result.current.handleDragEnd(dropOnSlot(hamilton.id, 'pole')));
    expect(result.current.slots.pole).toBeNull();
  });

  it('handleDragEnd with no drop target just clears the dragged driver', () => {
    const { result } = renderHook(() => usePodiumSlots(drivers, false, false));
    act(() => result.current.handleDragStart(dragStart(hamilton.id)));
    act(() => result.current.handleDragEnd({ active: { data: { current: { driverId: hamilton.id } } }, over: null } as unknown as DragEndEvent));
    expect(result.current.draggedDriver).toBeNull();
    expect(result.current.slots.p1).toBeNull();
  });
});
