import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { type Theme, defaultTheme, themes } from '../themes';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: defaultTheme,
  setTheme: () => {},
});

function applyThemeVars(theme: Theme): void {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(theme.vars)) {
    root.style.setProperty(key, value);
  }
  root.setAttribute('data-theme', theme.id);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('app-theme');
    return saved && themes[saved] ? themes[saved] : defaultTheme;
  });

  useEffect(() => {
    applyThemeVars(theme);
  }, [theme]);

  function setTheme(id: string) {
    const next = themes[id] ?? defaultTheme;
    localStorage.setItem('app-theme', next.id);
    setThemeState(next);
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
