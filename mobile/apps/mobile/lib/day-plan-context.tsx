/**
 * DayPlan context — single source of truth for all tabs.
 *
 * ADR-003: useDayPlan() runs ONCE at the tab layout level.
 * All tabs read from this context. No tab fetches its own plan independently.
 * Tab switches are instant — no loading, no redundant calendar fetches.
 */

import { createContext, useContext } from "react";
import type { CycleWindow, DayPlan } from "@r90/types";
import { useDayPlan } from "./use-day-plan";

interface DayPlanContextValue {
  dayPlan: DayPlan | null;
  loading: boolean;
  error: string | null;
  needsOnboarding: boolean;
  refreshPlan: () => void;
  applyConflictOption: (adjustedWindow: CycleWindow) => void;
}

const DayPlanContext = createContext<DayPlanContextValue | null>(null);

/** Wrap the tab group with this provider in app/(tabs)/_layout.tsx */
export function DayPlanProvider({ children }: { children: React.ReactNode }) {
  const value = useDayPlan();
  return (
    <DayPlanContext.Provider value={value}>
      {children}
    </DayPlanContext.Provider>
  );
}

/** Use inside any tab screen. Throws if called outside DayPlanProvider. */
export function useDayPlanContext(): DayPlanContextValue {
  const ctx = useContext(DayPlanContext);
  if (!ctx) {
    throw new Error("useDayPlanContext must be used within a DayPlanProvider");
  }
  return ctx;
}
