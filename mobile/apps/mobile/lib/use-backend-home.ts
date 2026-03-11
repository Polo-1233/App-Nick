/**
 * use-backend-home.ts — Hook for the HomeScreen backend payload.
 *
 * Fetches GET /screen/home from the nick_brain backend.
 * Falls back gracefully when backend is unavailable or user is not authenticated.
 *
 * Refresh strategy:
 *   - On mount
 *   - When user calls refresh() manually (e.g. after submitting a log)
 *   - Every 5 minutes while screen is active
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getHomeScreenPayload, type HomeScreenPayload } from './api';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 min

export interface UseBackendHomeResult {
  payload:   HomeScreenPayload | null;
  loading:   boolean;
  error:     string | null;
  refresh:   () => Promise<void>;
}

export function useBackendHome(): UseBackendHomeResult {
  const [payload, setPayload] = useState<HomeScreenPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    setError(null);
    const result = await getHomeScreenPayload();
    if (result.ok && result.data) {
      setPayload(result.data);
    } else {
      // Don't overwrite existing payload on refresh failure
      if (isInitial) setError(result.error ?? 'Could not load home screen');
    }
    if (isInitial) setLoading(false);
  }, []);

  useEffect(() => {
    void fetch(true);

    timerRef.current = setInterval(() => {
      void fetch(false);
    }, REFRESH_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetch]);

  const refresh = useCallback(async () => {
    await fetch(false);
  }, [fetch]);

  return { payload, loading, error, refresh };
}
