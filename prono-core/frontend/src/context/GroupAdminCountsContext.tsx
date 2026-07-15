import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { getAdminCounts } from '@/api/adminCounts';
import { LocalStorageService, StorageKey } from '@/utils/localStorage';

interface GroupAdminCountsContextType {
  totalBadge: number;
  pendingForfeitsPerGroup: Record<number, number>;
  missingGagesPerGroup: Record<number, number>;
  groupsWithNoBets: Record<number, boolean>;
  matchesWithoutBetsPerGroup: Record<number, number>;
  refresh: () => void;
  clearMatchesWithoutBetsAlert: () => void;
}

const GroupAdminCountsContext = createContext<GroupAdminCountsContextType>({
  totalBadge: 0,
  pendingForfeitsPerGroup: {},
  missingGagesPerGroup: {},
  groupsWithNoBets: {},
  matchesWithoutBetsPerGroup: {},
  refresh: () => {},
  clearMatchesWithoutBetsAlert: () => {},
});

function readAck(): Record<number, number> {
  return LocalStorageService.getJSON(StorageKey.AdminMatchesWithoutBetsAck, {});
}

function writeAck(ack: Record<number, number>) {
  LocalStorageService.setJSON(StorageKey.AdminMatchesWithoutBetsAck, ack);
}

/** Returns per-group effective count: max(0, real - acknowledged). */
function applyAck(
  real: Record<number, number>,
  ack: Record<number, number>,
): Record<number, number> {
  return Object.fromEntries(
    Object.entries(real).map(([k, v]) => [k, Math.max(0, v - (ack[Number(k)] ?? 0))]),
  );
}

export const GroupAdminCountsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [totalBadge, setTotalBadge] = useState(0);
  const [pendingForfeitsPerGroup, setPendingForfeitsPerGroup] = useState<Record<number, number>>({});
  const [missingGagesPerGroup, setMissingGagesPerGroup] = useState<Record<number, number>>({});
  const [groupsWithNoBets, setGroupsWithNoBets] = useState<Record<number, boolean>>({});
  const [matchesWithoutBetsPerGroup, setMatchesWithoutBetsPerGroup] = useState<Record<number, number>>({});
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const clearMatchesWithoutBetsAlert = useCallback(() => {
    // Read the latest real counts from state, persist them as acknowledged
    setMatchesWithoutBetsPerGroup((current) => {
      const ack = readAck();
      const nextAck: Record<number, number> = { ...ack };
      Object.entries(current).forEach(([k, effectiveCount]) => {
        // effective = real - ack, so real = effective + ack
        const gid = Number(k);
        nextAck[gid] = effectiveCount + (ack[gid] ?? 0);
      });
      writeAck(nextAck);
      // All effective counts become 0
      return Object.fromEntries(Object.keys(current).map((k) => [k, 0]));
    });
    setTotalBadge((prev) => {
      const effectiveTotal = Object.values(matchesWithoutBetsPerGroup).reduce((s, v) => s + v, 0);
      return Math.max(0, prev - effectiveTotal);
    });
  }, [matchesWithoutBetsPerGroup]);

  useEffect(() => {
    if (!user) {
      setTotalBadge(0);
      setPendingForfeitsPerGroup({});
      setMissingGagesPerGroup({});
      setMatchesWithoutBetsPerGroup({});
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const counts = await getAdminCounts();
        if (cancelled) return;

        const pendingForfeits = Object.values(counts.pendingForfeitsPerGroup).reduce((s, v) => s + v, 0);
        const missingGages = Object.values(counts.missingGagesPerGroup).reduce((s, v) => s + v, 0);

        const rawMatches: Record<number, number> = counts.matchesWithoutBetsPerGroup ?? {};
        const ack = readAck();
        const effectiveMatches = applyAck(rawMatches, ack);
        const matchesWithoutBets = Object.values(effectiveMatches).reduce((s, v) => s + v, 0);

        setPendingForfeitsPerGroup(counts.pendingForfeitsPerGroup);
        setMissingGagesPerGroup(counts.missingGagesPerGroup);
        setGroupsWithNoBets(counts.groupsWithNoBets);
        setMatchesWithoutBetsPerGroup(effectiveMatches);
        setTotalBadge(counts.pendingApplications + pendingForfeits + missingGages + matchesWithoutBets);
      } catch {
        // badge errors are non-blocking
      }
    })();

    return () => { cancelled = true; };
  }, [user, tick]);

  return (
    <GroupAdminCountsContext.Provider value={{ totalBadge, pendingForfeitsPerGroup, missingGagesPerGroup, groupsWithNoBets, matchesWithoutBetsPerGroup, refresh, clearMatchesWithoutBetsAlert }}>
      {children}
    </GroupAdminCountsContext.Provider>
  );
};

export const useGroupAdminCounts = () => useContext(GroupAdminCountsContext);
