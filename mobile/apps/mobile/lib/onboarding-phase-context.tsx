/**
 * OnboardingPhaseContext
 *
 * Shared between _layout.tsx (orchestrator) and HomeScreen (guided chat).
 * Phase transitions are written to AsyncStorage so they survive navigation.
 */
import { createContext, useContext, type ReactNode } from 'react';
import type { OnboardingPhase } from './storage';

interface OnboardingPhaseCtx {
  phase:   OnboardingPhase;
  advance: (next: OnboardingPhase) => void;
}

const Ctx = createContext<OnboardingPhaseCtx>({
  phase:   'done',
  advance: () => {},
});

export function OnboardingPhaseProvider({
  phase,
  advance,
  children,
}: { phase: OnboardingPhase; advance: (next: OnboardingPhase) => void; children: ReactNode }) {
  return <Ctx.Provider value={{ phase, advance }}>{children}</Ctx.Provider>;
}

export function useOnboardingPhase() { return useContext(Ctx); }
