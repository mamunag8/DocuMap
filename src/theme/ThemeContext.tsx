import React, { createContext, useContext, useState, useMemo } from 'react';
import { ThemeMode } from '../models/types';
import { AppThemeColors, getThemeColors } from './theme';

interface ThemeContextValue {
  themeMode: ThemeMode;
  theme: AppThemeColors;
  setThemeMode: (mode: ThemeMode) => void;
  cycleThemeMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark');

  const cycleThemeMode = () => {
    setThemeMode((prev) => {
      if (prev === 'dark') return 'oled';
      if (prev === 'oled') return 'light';
      return 'dark';
    });
  };

  const value = useMemo<ThemeContextValue>(
    () => ({
      themeMode,
      theme: getThemeColors(themeMode),
      setThemeMode,
      cycleThemeMode,
    }),
    [themeMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useAppTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useAppTheme must be used inside a ThemeProvider');
  }
  return ctx;
}
