import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { getAdminCounts } from '../api/adminCounts';

interface GroupAdminCountsContextType {
  totalBadge: number;
  pendingForfeitsPerGroup: Record<number, number>;
  missingGagesPerGroup: Record<number, number>;
  groupsWithNoBets: Record<number, boolean>;
  refresh: () => void;
}

const GroupAdminCountsContext = createContext<GroupAdminCountsContextType>({
  totalBadge: 0,
  pendingForfeitsPerGroup: {},
  missingGagesPerGroup: {},
  groupsWithNoBets: {},
  refresh: () => {},
});

export const GroupAdminCountsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [totalBadge, setTotalBadge] = useState(0);
  const [pendingForfeitsPerGroup, setPendingForfeitsPerGroup] = useState<Record<number, number>>({});
  const [missingGagesPerGroup, setMissingGagesPerGroup] = useState<Record<number, number>>({});
  const [groupsWithNoBets, setGroupsWithNoBets] = useState<Record<number, boolean>>({});
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
        const counts = await getAdminCounts();
        if (cancelled) return;

        const pendingForfeits = Object.values(counts.pendingForfeitsPerGroup).reduce((s, v) => s + v, 0);
        const missingGages = Object.values(counts.missingGagesPerGroup).reduce((s, v) => s + v, 0);
        const groupsNoBetsCount = Object.values(counts.groupsWithNoBets).filter(Boolean).length;

        setPendingForfeitsPerGroup(counts.pendingForfeitsPerGroup);
        setMissingGagesPerGroup(counts.missingGagesPerGroup);
        setGroupsWithNoBets(counts.groupsWithNoBets);
        setTotalBadge(counts.pendingApplications + pendingForfeits + missingGages + groupsNoBetsCount);
      } catch {
        // badge errors are non-blocking
      }
    })();

    return () => { cancelled = true; };
  }, [user, tick]);

  return (
    <GroupAdminCountsContext.Provider value={{ totalBadge, pendingForfeitsPerGroup, missingGagesPerGroup, groupsWithNoBets, refresh }}>
      {children}
    </GroupAdminCountsContext.Provider>
  );
};

export const useGroupAdminCounts = () => useContext(GroupAdminCountsContext);
