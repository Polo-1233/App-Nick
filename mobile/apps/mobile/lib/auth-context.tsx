/**
 * auth-context.tsx — Global auth state for the R90 Navigator app.
 *
 * Wraps the root layout. Provides:
 *   - currentSession: Supabase Session | null
 *   - isAuthenticated: boolean
 *   - isLoading: boolean (while restoring session from SecureStore)
 *   - login() / logout() / register()
 *
 * On mount: restores session from SecureStore via getSession().
 * On session change: re-routes the app (handled by root _layout.tsx watching isAuthenticated).
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  signIn,
  signUp,
  signOut,
  getSession,
  onAuthStateChange,
  type AuthResult,
} from './supabase';
import { bootstrapUser } from './api';
import { identifyUser, resetPurchasesUser } from './purchases';

// ─── Context shape ────────────────────────────────────────────────────────────

interface AuthContextValue {
  session:         Session | null;
  isAuthenticated: boolean;
  isLoading:       boolean;
  login:           (email: string, password: string) => Promise<AuthResult>;
  register:        (email: string, password: string) => Promise<AuthResult>;
  logout:          () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session:         null,
  isAuthenticated: false,
  isLoading:       true,
  login:           async () => ({ ok: false, error: 'No provider' }),
  register:        async () => ({ ok: false, error: 'No provider' }),
  logout:          async () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session,   setSession]   = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on mount + subscribe to changes
  useEffect(() => {
    // Restore from SecureStore
    getSession().then(s => {
      setSession(s);
      setIsLoading(false);
    });

    // Subscribe to future auth state changes
    const unsubscribe = onAuthStateChange(s => {
      setSession(s);
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const result = await signIn(email, password);
    if (result.ok && result.session) {
      setSession(result.session);
      // Identify user in RevenueCat so purchase history follows across devices
      void identifyUser(result.session.user.id);
    }
    return result;
  }, []);

  const register = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const result = await signUp(email, password);
    if (result.ok && result.session) {
      setSession(result.session);
      // Bootstrap backend + identify in RevenueCat
      await bootstrapUser();
      void identifyUser(result.session.user.id);
    }
    return result;
  }, []);

  const logout = useCallback(async () => {
    await signOut();
    await resetPurchasesUser();
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      session,
      isAuthenticated: !!session,
      isLoading,
      login,
      register,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth() {
  return useContext(AuthContext);
}
