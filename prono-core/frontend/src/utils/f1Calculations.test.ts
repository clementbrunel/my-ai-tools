import { describe, it, expect } from 'vitest';
import { computeLapsDown } from './f1Calculations';
import type { Driver, RaceResultEntry } from '@/types';

const driver = (id: number): Driver => ({
  id, name: `Driver ${id}`, code: `D${id}`, number: id,
  constructorId: 1, constructorName: 'Team', constructorColor: '#000000',
});

const entry = (id: number, position: number | null, time: string | null): RaceResultEntry => ({
  driver: driver(id), constructorId: 1, constructorName: 'Team', constructorColor: '#000000',
  position, sprintPosition: null, pole: false, fastestLap: false, dnf: position == null, time,
});

describe('computeLapsDown', () => {
  it('flags no one down when the gap only grows', () => {
    const results = [
      entry(1, 1, '1:39:56.180'),
      entry(2, 2, '+15.080'),
      entry(3, 3, '+18.728'),
    ];
    expect(computeLapsDown(results)).toEqual(new Map());
  });

  // Real classification (2026 Hungarian GP): the interval resets each time a
  // backmarker is lapped, so the gap column drops instead of only growing.
  it('marks a lap down every time the gap drops, and carries the count forward', () => {
    const results = [
      entry(1, 1, '1:39:56.180'),
      entry(2, 2, '+15.080'),
      entry(3, 3, '+18.728'),
      entry(4, 4, '+23.840'),
      entry(5, 5, '+24.540'),
      entry(6, 6, '+55.488'),
      entry(7, 7, '+57.503'),
      entry(8, 8, '+28.033'), // drop → 1 lap down
      entry(9, 9, '+30.382'),
      entry(10, 10, '+51.050'),
      entry(11, 11, '+52.028'),
      entry(12, 12, '+53.429'),
      entry(13, 13, '+1:03.828'),
      entry(14, 14, '+1:06.052'),
      entry(15, 15, '+3.876'), // drop → 2 laps down
      entry(16, 16, '+12.859'),
      entry(17, 17, '+52.729'),
      entry(18, 18, '+52.973'),
      entry(19, 19, '+57.198'),
      entry(20, null, null), // NC, unclassified
    ];

    const lapsDown = computeLapsDown(results);

    expect(lapsDown.get(7)).toBeUndefined();
    expect(lapsDown.get(8)).toBe(1);
    expect(lapsDown.get(14)).toBe(1);
    expect(lapsDown.get(15)).toBe(2);
    expect(lapsDown.get(19)).toBe(2);
    expect(lapsDown.get(20)).toBeUndefined();
  });

  it('ignores rows with no time (unclassified) without breaking the running count', () => {
    const results = [
      entry(1, 1, '1:39:56.180'),
      entry(2, 2, '+10.000'),
      entry(3, 3, null),
      entry(4, 4, '+5.000'), // still a drop relative to the last seen gap
    ];
    expect(computeLapsDown(results).get(4)).toBe(1);
  });
});
