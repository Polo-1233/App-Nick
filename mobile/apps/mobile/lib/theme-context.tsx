/**
 * ThemeProvider + useTheme hook.
 *
 * - Reads persisted ThemeMode + immersiveMode from AsyncStorage on mount.
 * - Uses useColorScheme() to resolve 'system' → actual theme.
 * - Exposes { theme, mode, setMode, immersiveMode, setImmersiveMode }.
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  type ThemeMode,
  type Theme,
  darkTheme,
  lightTheme,
  THEME_STORAGE_KEY,
  IMMERSIVE_STORAGE_KEY,
} from './theme';

// ─── Context ──────────────────────────────────────────────────────────────────

interface ThemeContextValue {
  theme:             Theme;
  mode:              ThemeMode;
  setMode:           (mode: ThemeMode) => Promise<void>;
  immersiveMode:     boolean;
  setImmersiveMode:  (val: boolean) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme:            darkTheme,
  mode:             'system',
  setMode:          async () => {},
  immersiveMode:    true,
  setImmersiveMode: async () => {},
});

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme          = useColorScheme(); // 'light' | 'dark' | null
  const [mode, setModeState]  = useState<ThemeMode>('system');
  const [immersiveMode, setImmersiveModeState] = useState<boolean>(true); // default ON

  // Restore both persisted preferences on mount
  useEffect(() => {
    AsyncStorage.multiGet([THEME_STORAGE_KEY, IMMERSIVE_STORAGE_KEY]).then(
      ([[, storedTheme], [, storedImmersive]]) => {
        if (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system') {
          setModeState(storedTheme);
        }
        if (storedImmersive !== null) {
          setImmersiveModeState(storedImmersive !== 'false');
        }
      },
    );
  }, []);

  const setMode = useCallback(async (next: ThemeMode) => {
    setModeState(next);
    await AsyncStorage.setItem(THEME_STORAGE_KEY, next);
  }, []);

  const setImmersiveMode = useCallback(async (val: boolean) => {
    setImmersiveModeState(val);
    await AsyncStorage.setItem(IMMERSIVE_STORAGE_KEY, val ? 'true' : 'false');
  }, []);

  // Resolve effective theme
  const effectiveDark =
    mode === 'dark'  ? true  :
    mode === 'light' ? false :
    systemScheme === 'dark';

  const theme = effectiveDark ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ theme, mode, setMode, immersiveMode, setImmersiveMode }}>
      {children}
    </ThemeContext.Provider>
  );
}
