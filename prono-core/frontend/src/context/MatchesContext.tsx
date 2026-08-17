import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { getMatchesForMyGroups } from '@/api/matches';
import { useMyGroups } from './MyGroupsContext';
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
  const { groups } = useMyGroups();
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const fetchedAtRef = useRef<number | null>(null);
  const pendingRef = useRef<Promise<void> | null>(null);

  // groups is null while MyGroupsContext is still loading — default to true so
  // the empty-state banner doesn't flash before the real groups arrive.
  const hasGroups = groups === null || groups.length > 0;

  const fetchIfNeeded = useCallback(() => {
    const now = Date.now();
    if (fetchedAtRef.current && now - fetchedAtRef.current < STALE_MS) return;
    if (pendingRef.current) return;

    // Show spinner only on the very first load; subsequent refreshes are silent.
    if (fetchedAtRef.current === null) setIsLoading(true);

    const doFetch = async () => {
      try {
        const matchesData = await getMatchesForMyGroups();
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
