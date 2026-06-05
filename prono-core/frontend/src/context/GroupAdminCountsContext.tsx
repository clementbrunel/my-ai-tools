import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { getMyGroups } from '../api/groups';
import { getGroupPendingForfeits } from '../api/forfeits';
import { getAllDailyGages } from '../api/dailyGages';
import { getMatches } from '../api/matches';

interface GroupAdminCountsContextType {
  totalBadge: number;
  pendingForfeitsPerGroup: Record<number, number>;
  missingGagesPerGroup: Record<number, number>;
  refresh: () => void;
}

const GroupAdminCountsContext = createContext<GroupAdminCountsContextType>({
  totalBadge: 0,
  pendingForfeitsPerGroup: {},
  missingGagesPerGroup: {},
  refresh: () => {},
});

export const GroupAdminCountsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [totalBadge, setTotalBadge] = useState(0);
  const [pendingForfeitsPerGroup, setPendingForfeitsPerGroup] = useState<Record<number, number>>({});
  const [missingGagesPerGroup, setMissingGagesPerGroup] = useState<Record<number, number>>({});
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!user) {
      setTotalBadge(0);
      setPendingForfeitsPerGroup({});
      setMissingGagesPerGroup({});
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const groups = await getMyGroups();
        const adminGroups = groups.filter((g) => g.currentUserRole === 'GROUP_ADMIN');
        const pendingApplications = adminGroups.reduce(
          (sum, g) => sum + (g.pendingApplications?.length ?? 0), 0
        );

        if (adminGroups.length === 0) {
          if (!cancelled) {
            setTotalBadge(pendingApplications);
            setPendingForfeitsPerGroup({});
            setMissingGagesPerGroup({});
          }
          return;
        }

        const [forfeitResults, dgResult, matchesResult] = await Promise.allSettled([
          Promise.allSettled(adminGroups.map((g) => getGroupPendingForfeits(g.id))),
          getAllDailyGages(),
          getMatches(),
        ]);

        if (cancelled) return;

        const forfeitsPerGroup: Record<number, number> = {};
        let pendingForfeits = 0;
        if (forfeitResults.status === 'fulfilled') {
          adminGroups.forEach((g, i) => {
            const r = forfeitResults.value[i];
            if (r.status === 'fulfilled') {
              forfeitsPerGroup[g.id] = r.value.length;
              pendingForfeits += r.value.length;
            }
          });
        }

        const missingPerGroup: Record<number, number> = {};
        let missingGages = 0;
        if (dgResult.status === 'fulfilled' && matchesResult.status === 'fulfilled') {
          const allDg = dgResult.value;
          const allMatchDates = [...new Set(matchesResult.value.map((m) => m.matchDate.slice(0, 10)))];
          adminGroups.forEach((g) => {
            const configuredWithForfeit = new Set(
              allDg.filter((d) => d.groupId === g.id && d.forfeit != null).map((d) => d.matchDate)
            );
            const count = allMatchDates.filter((d) => !configuredWithForfeit.has(d)).length;
            missingPerGroup[g.id] = count;
            missingGages += count;
          });
        }

        setPendingForfeitsPerGroup(forfeitsPerGroup);
        setMissingGagesPerGroup(missingPerGroup);
        setTotalBadge(pendingApplications + pendingForfeits + missingGages);
      } catch {
        // badge errors are non-blocking
      }
    })();

    return () => { cancelled = true; };
  }, [user, tick]);

  return (
    <GroupAdminCountsContext.Provider value={{ totalBadge, pendingForfeitsPerGroup, missingGagesPerGroup, refresh }}>
      {children}
    </GroupAdminCountsContext.Provider>
  );
};

export const useGroupAdminCounts = () => useContext(GroupAdminCountsContext);
