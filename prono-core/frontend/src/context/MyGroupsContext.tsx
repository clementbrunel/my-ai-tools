import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { getMyGroups } from '@/api/groups';
import type { Group } from '@/types';

interface MyGroupsContextType {
  /** null while loading or logged out. */
  groups: Group[] | null;
  refresh: () => void;
}

const MyGroupsContext = createContext<MyGroupsContextType>({
  groups: null,
  refresh: () => {},
});

/** Single shared fetch of the user's groups — avoids re-fetching the same
 *  data (e.g. Navbar) whenever a component only needs to read group info. */
export const MyGroupsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!user) {
      setGroups(null);
      return;
    }

    let cancelled = false;

    getMyGroups()
      .then((data) => { if (!cancelled) setGroups(data); })
      .catch(() => { /* non-blocking */ });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, tick]);

  return (
    <MyGroupsContext.Provider value={{ groups, refresh }}>
      {children}
    </MyGroupsContext.Provider>
  );
};

export const useMyGroups = () => useContext(MyGroupsContext);
