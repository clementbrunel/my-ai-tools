import type { Driver, F1Prediction, Race } from '../types';

/**
 * Client-side helpers for the F1 "Podium +" scoring — the F1 twin of
 * `matchCalculations.ts`. The credited total always comes from the backend
 * (`pointsEarned`); these helpers only drive the per-pick display chips
 * (green = exact, yellow = right driver wrong step, gray = missed).
 */

export type F1SlotKey = 'p1' | 'p2' | 'p3' | 'pole' | 'fastestLap' | 'last';

export interface PickVerdict {
  /** Points this pick is worth with the official Podium+ scale. */
  points: number;
  /** Exact hit (right driver at the right place). */
  correct: boolean;
  /** Podium only: right driver, wrong step (1 pt). */
  partial: boolean;
}

const MISS: PickVerdict = { points: 0, correct: false, partial: false };

/**
 * Compares a prediction against the race's final classification and returns
 * one verdict per pick. Returns null while the race has no results.
 *
 * Rules mirrored from the backend (F1RaceService):
 * - P1/P2/P3 exact → 3/2/2 pts; right driver on the wrong podium step → 1 pt
 * - pole → 2 pts, meilleur tour → 1 pt
 * - lanterne rouge = last CLASSIFIED driver (DNFs without classification
 *   don't count) → 2 pts
 * - the Grand Chelem bonus (+2) is NOT computed here: it is part of the
 *   backend total (pointsEarned).
 */
export function computeF1Verdicts(
  prediction: F1Prediction,
  race: Race,
): Record<F1SlotKey, PickVerdict> | null {
  const results = race.results;
  if (!results || results.length === 0) return null;

  // Rebuild the outcome: who finished where, pole, fastest lap, last classified.
  const byPos = new Map<number, number>();
  let pole: number | null = null;
  let fastest: number | null = null;
  let last: number | null = null;
  let maxPos = -1;
  for (const r of results) {
    if (r.position != null) {
      byPos.set(r.position, r.driver.id);
      if (r.position > maxPos) {
        maxPos = r.position;
        last = r.driver.id;
      }
    }
    if (r.pole) pole = r.driver.id;
    if (r.fastestLap) fastest = r.driver.id;
  }

  const podium = [byPos.get(1), byPos.get(2), byPos.get(3)];
  const podiumVerdict = (picked: Driver | null, slot: 1 | 2 | 3, exact: number): PickVerdict => {
    if (!picked) return MISS;
    if (byPos.get(slot) === picked.id) return { points: exact, correct: true, partial: false };
    if (podium.includes(picked.id)) return { points: 1, correct: false, partial: true };
    return MISS;
  };
  const simple = (picked: Driver | null, actual: number | null, pts: number): PickVerdict =>
    picked && actual === picked.id ? { points: pts, correct: true, partial: false } : MISS;

  return {
    p1: podiumVerdict(prediction.p1, 1, 3),
    p2: podiumVerdict(prediction.p2, 2, 2),
    p3: podiumVerdict(prediction.p3, 3, 2),
    pole: simple(prediction.pole, pole, 2),
    fastestLap: simple(prediction.fastestLap, fastest, 1),
    last: simple(prediction.lastClassified, last, 2),
  };
}
