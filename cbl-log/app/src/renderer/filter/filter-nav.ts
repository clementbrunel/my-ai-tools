import type { FilterLocation, SearchHit } from "@cbl-log/shared";

/** Hits on hidden lines skipped before giving up (each costs two round trips to the engine). */
export const MAX_SKIPPED_HITS = 500;

export interface VisibleHit {
  hit: SearchHit;
  /** Position of the hit in the filtered view. */
  position: number;
}

/**
 * Next / previous search hit that the filtered view shows. The search runs on the whole file, so a hit
 * can be on a line the filter hides: it is skipped. undefined = no hit on a displayed line (or none at all).
 */
export async function nextVisibleHit(
  searchNext: (fromRow: number, dir: "next" | "prev") => Promise<SearchHit>,
  locate: (row: number) => Promise<FilterLocation>,
  fromRow: number,
  dir: "next" | "prev",
  maxSkips = MAX_SKIPPED_HITS,
): Promise<VisibleHit | undefined> {
  let first: number | undefined;
  let from = fromRow;
  for (let i = 0; i < maxSkips; i++) {
    const hit = await searchNext(from, dir);
    if (hit.row === null) return undefined;
    if (first === undefined) first = hit.row;
    else if (hit.row === first) return undefined; // all the way around: every hit is hidden
    const where = await locate(hit.row);
    if (where.exact) return { hit, position: where.position };
    from = hit.row;
  }
  return undefined;
}
