import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { getMatchesForMyGroups } from '@/api/matches';
import { getMyGroups } from '@/api/groups';
import type { Match } from '@/types';
import { logger } from '@/utils/logger';

const STALE_MS = 5 * 60 * 1000;

interface MatchesCtx {
  matches: Match[];
  hasGroups: boolean;
  isLoading: boolean;
  fetchIfNeeded: () => void;
  markParticipated: (matchId: number) => void;
}

const MatchesContext = createContext<MatchesCtx | null>(null);

export function MatchesProvider({ children }: { children: React.ReactNode }) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [hasGroups, setHasGroups] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const fetchedAtRef = useRef<number | null>(null);
  const pendingRef = useRef<Promise<void> | null>(null);

  const fetchIfNeeded = useCallback(() => {
    const now = Date.now();
    if (fetchedAtRef.current && now - fetchedAtRef.current < STALE_MS) return;
    if (pendingRef.current) return;

    // Show spinner only on the very first load; subsequent refreshes are silent.
    if (fetchedAtRef.current === null) setIsLoading(true);

    const doFetch = async () => {
      try {
        const [groups, matchesData] = await Promise.all([
          getMyGroups(),
          getMatchesForMyGroups(),
        ]);
        setHasGroups(groups.length > 0);
        setMatches(matchesData);
        fetchedAtRef.current = Date.now();
      } catch (err) {
        logger.error('Error loading matches:', err);
      } finally {
        setIsLoading(false);
        pendingRef.current = null;
      }
    };

    pendingRef.current = doFetch();
  }, []);

  const markParticipated = useCallback((matchId: number) => {
    setMatches(prev => prev.map(m => m.id === matchId ? { ...m, userParticipated: true } : m));
  }, []);

  return (
    <MatchesContext.Provider value={{ matches, hasGroups, isLoading, fetchIfNeeded, markParticipated }}>
      {children}
    </MatchesContext.Provider>
  );
}

export function useMatches() {
  const ctx = useContext(MatchesContext);
  if (!ctx) throw new Error('useMatches must be used within MatchesProvider');
  return ctx;
}
