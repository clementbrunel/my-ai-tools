export interface ThemeVars {
  '--theme-primary': string;
  '--theme-primary-dark': string;
  '--theme-accent': string;
  '--theme-accent-mid': string;
  '--theme-danger': string;
  '--theme-dark': string;
  '--theme-dark-secondary': string;
}

export interface Theme {
  id: string;
  name: string;
  vars: ThemeVars;
}

export const footballTheme: Theme = {
  id: 'football',
  name: 'Football',
  vars: {
    '--theme-primary': '#009900',
    '--theme-primary-dark': '#006400',
    '--theme-accent': '#FFD700',
    '--theme-accent-mid': '#FFA500',
    '--theme-danger': '#CC0000',
    '--theme-dark': '#0a1628',
    '--theme-dark-secondary': '#112240',
  },
};

export const f1Theme: Theme = {
  id: 'f1',
  name: 'F1',
  vars: {
    '--theme-primary': '#E10600',
    '--theme-primary-dark': '#9B0400',
    '--theme-accent': '#C0C0C0',
    '--theme-accent-mid': '#FFFFFF',
    '--theme-danger': '#FF6B00',
    '--theme-dark': '#15151E',
    '--theme-dark-secondary': '#1F1F2E',
  },
};

export const themes: Record<string, Theme> = {
  football: footballTheme,
  f1: f1Theme,
};

export const defaultTheme = footballTheme;
