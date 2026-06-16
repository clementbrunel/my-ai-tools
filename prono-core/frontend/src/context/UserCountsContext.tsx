import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { getUserCounts } from '../api/userCounts';

interface UserCountsContextType {
  pendingGages: number;
  totalBadge: number;
  refresh: () => void;
}

const UserCountsContext = createContext<UserCountsContextType>({
  pendingGages: 0,
  totalBadge: 0,
  refresh: () => {},
});

export const UserCountsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [pendingGages, setPendingGages] = useState(0);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!user) {
      setPendingGages(0);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const counts = await getUserCounts();
        if (cancelled) return;
        setPendingGages(counts.pendingGages);
      } catch {
        // badge errors are non-blocking
      }
    })();

    return () => { cancelled = true; };
  }, [user, tick]);

  return (
    <UserCountsContext.Provider value={{ pendingGages, totalBadge: pendingGages, refresh }}>
      {children}
    </UserCountsContext.Provider>
  );
};

export const useUserCounts = () => useContext(UserCountsContext);
