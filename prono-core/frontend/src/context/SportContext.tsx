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

    const emoji = sport === 'f1' ? '🏎' : '⚽';
    const favicon = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
    if (favicon) {
      favicon.href = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>${emoji}</text></svg>`;
    }
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
