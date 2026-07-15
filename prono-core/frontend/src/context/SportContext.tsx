import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useTheme } from './ThemeContext';
import { LocalStorageService, StorageKey } from '../utils/localStorage';

export type Sport = 'foot' | 'f1';

interface SportContextValue {
  sport: Sport;
  basePath: string;
  /** Force the active sport without a navigation — needed on shared pages
   * (/admin, /profile, /groups) where the URL doesn't carry a sport prefix,
   * so the usual "sport follows the URL" sync never fires. */
  setSport: (sport: Sport) => void;
}

const SportContext = createContext<SportContextValue>({
  sport: 'foot',
  basePath: '/foot',
  setSport: () => {},
});

function storedSport(): Sport {
  return LocalStorageService.getString(StorageKey.Sport) === 'f1' ? 'f1' : 'foot';
}

/**
 * The active sport follows the URL prefix (/foot, /f1) and is remembered on
 * shared pages (/groups, /admin, /profile) so navigating there keeps the
 * current universe — theme, navbar and back-links included.
 */
export function SportProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { setTheme } = useTheme();
  const [sport, setSportState] = useState<Sport>(storedSport);

  const setSport = (next: Sport) => {
    setSportState(next);
    LocalStorageService.setString(StorageKey.Sport, next);
  };

  useEffect(() => {
    const fromPath: Sport | null = pathname.startsWith('/f1')
      ? 'f1'
      : pathname.startsWith('/foot')
        ? 'foot'
        : null;   // shared page → keep the last visited sport
    if (fromPath && fromPath !== sport) {
      setSport(fromPath);
    }
  }, [pathname, sport]);

  const basePath = `/${sport}`;

  useEffect(() => {
    setTheme(sport === 'f1' ? 'f1' : 'football');

    const emoji = sport === 'f1' ? '🏎' : '⚽';
    const favicon = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
    if (favicon) {
      favicon.href = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>${emoji}</text></svg>`;
    }
  }, [sport]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SportContext.Provider value={{ sport, basePath, setSport }}>
      {children}
    </SportContext.Provider>
  );
}

export function useSport() {
  return useContext(SportContext);
}
