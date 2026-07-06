import { createContext, useContext, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useTheme } from './ThemeContext';

export type Sport = 'foot' | 'f1';

interface SportContextValue {
  sport: Sport;
  basePath: string;
}

const SportContext = createContext<SportContextValue>({ sport: 'foot', basePath: '/foot' });

export function SportProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { setTheme } = useTheme();

  const sport: Sport = pathname.startsWith('/f1') ? 'f1' : 'foot';
  const basePath = `/${sport}`;

  useEffect(() => {
    setTheme(sport === 'f1' ? 'f1' : 'football');
  }, [sport]);

  return (
    <SportContext.Provider value={{ sport, basePath }}>
      {children}
    </SportContext.Provider>
  );
}

export function useSport() {
  return useContext(SportContext);
}
