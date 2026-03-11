/**
 * use-backend-day-plan.ts — Hook for the backend DayPlan payload.
 * Fetches GET /screen/day-plan from the nick_brain backend.
 */
import { useState, useEffect, useCallback } from "react";
import { getDayPlanPayload, type DayPlanPayload } from "./api";

export interface UseBackendDayPlanResult {
  payload:  DayPlanPayload | null;
  loading:  boolean;
  error:    string | null;
  refresh:  () => Promise<void>;
}

export function useBackendDayPlan(date?: string): UseBackendDayPlanResult {
  const [payload, setPayload] = useState<DayPlanPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const fetch = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    setError(null);
    const result = await getDayPlanPayload(date);
    if (result.ok && result.data) {
      setPayload(result.data);
    } else {
      if (initial) setError(result.error ?? "Could not load day plan");
    }
    if (initial) setLoading(false);
  }, [date]);

  useEffect(() => { void fetch(true); }, [fetch]);

  const refresh = useCallback(async () => { await fetch(false); }, [fetch]);

  return { payload, loading, error, refresh };
}
