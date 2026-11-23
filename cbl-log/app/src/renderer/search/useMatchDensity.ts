import { useEffect, useRef, useState } from "react";
import type { RpcClient } from "../engine/rpc-client";

/** Number of slices of the file the matches are counted in (one marker each, at most). */
export const DENSITY_BUCKETS = 256;
/** At most one request per this delay: the file may grow, or the search progress, much faster. */
export const DENSITY_INTERVAL_MS = 300;

export interface DensityInput {
  tabId: string | undefined;
  /** Search in force; the markers are only shown for it. */
  searchId: string | undefined;
  /** Markers are not drawn (filtered view: its rows are not those of the file). */
  disabled: boolean;
  /** Matches found so far: moves while the search progresses. */
  matches: number;
  /** Rows of the range shown on the scrollbar, from `first` (rows before it are cleared). */
  first: number;
  count: number;
}

/**
 * Where the matches found so far lie in the file, in `DENSITY_BUCKETS` slices, refreshed while the
 * search progresses or the file grows. Throttled, not debounced: while lines keep arriving, a debounce
 * would wait for a calm that never comes and the markers would never move.
 */
export function useMatchDensity(input: DensityInput, withEngine: () => Promise<RpcClient>): number[] | undefined {
  const [result, setResult] = useState<{ tabId: string; searchId: string; counts: number[] } | undefined>();
  const latest = useRef(input);
  latest.current = input;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { tabId, searchId, disabled, matches, first, count } = input;
  const active = !!tabId && !!searchId && !disabled && matches > 0 && count > 0;

  // another tab / search / view: forget the markers and the pending request
  useEffect(() => {
    return () => {
      clearTimeout(timer.current);
      timer.current = undefined;
    };
  }, [tabId, searchId, active]);

  useEffect(() => {
    if (!active) {
      setResult(undefined);
      return;
    }
    if (timer.current) return; // a request is already planned: it will read the latest input
    timer.current = setTimeout(() => {
      timer.current = undefined;
      const { tabId: t, searchId: s, first: f, count: c } = latest.current;
      if (!t || !s) return;
      void withEngine()
        .then((engine) => engine.request("searchDensity", { tabId: t, searchId: s, first: f, count: c, buckets: DENSITY_BUCKETS }))
        .then(({ counts }) => {
          // drop an answer that arrives after the search or the tab changed
          if (latest.current.tabId === t && latest.current.searchId === s) setResult({ tabId: t, searchId: s, counts });
        })
        .catch(() => {});
    }, DENSITY_INTERVAL_MS);
  }, [active, matches, first, count, withEngine]);

  return active && result && result.tabId === tabId && result.searchId === searchId ? result.counts : undefined;
}
