// src/features/analytics/hooks/useAnalytics.js

// Single hook that exposes all analytics data your page needs.
// Uses plain fetch state (loading / error / data) no Redux or Zustand required.


import { useState, useEffect, useCallback } from 'react';
import {
  getSummary,
  getTopViewed,
  getTrending,
  getMyStats,
  getMyStatsTrend,
  getBatchmates,
} from '../../../api/analytics.api';

/**
 * Generic async data fetcher with loading / error state.
 *
 * @template T
 * @param {() => Promise<T>} fetchFn
 * @returns {{ data: T|null, loading: boolean, error: string|null, refetch: () => void }}
 */
function useAsync(fetchFn) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const run = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    fetchFn()
      .then(setData)
      .catch((err) => setError(err?.response?.data?.message ?? err.message ?? 'Error'))
      .finally(() => setLoading(false));
  }, [fetchFn]);

  useEffect(() => { run(); }, [run]);

  return { data, loading, error, refetch: run };
}



/**
 * Platform summary counts.
 * @returns {{ data, loading, error, refetch }}
 */
export function useSummary() {
  return useAsync(useCallback(getSummary, []));
}

/**
 * Top-viewed alumni (all-time).
 * @param {number} limit
 */
export function useTopViewed(limit = 10) {
  const fn = useCallback(() => getTopViewed(limit), [limit]);
  const result = useAsync(fn);
  return { ...result, data: result.data?.data ?? [] };
}

/**
 * Trending alumni (last 7 days).
 * @param {number} limit
 */
export function useTrending(limit = 10) {
  const fn = useCallback(() => getTrending(limit), [limit]);
  const result = useAsync(fn);
  return {
    ...result,
    data: result.data?.data ?? [],
    viewsThisWeek: Number(result.data?.views_this_week ?? 0),
  };
}

/**
 * Logged-in student's personal stats.
 * Pass `enabled = false` when the user is not authenticated.
 * @param {boolean} enabled
 */
export function useMyStats(enabled = true) {
  const fn = useCallback(() => (enabled ? getMyStats() : Promise.resolve(null)), [enabled]);
  return useAsync(fn);
}

/**
 * Daily view trend for the logged-in student.
 * @param {number}  days
 * @param {boolean} enabled
 * @returns {{ labels: string[], values: number[], loading, error, refetch }}
 */
export function useMyStatsTrend(days = 30, enabled = true) {
  const fn = useCallback(
    () => (enabled ? getMyStatsTrend(days) : Promise.resolve(null)),
    [days, enabled]
  );
  const result = useAsync(fn);

  const raw    = result.data?.data ?? {};
  const labels = Object.keys(raw);
  const values = Object.values(raw);

  return { ...result, labels, values };
}

/**
 * Top-viewed batchmates of the logged-in student.
 * @param {boolean} enabled
 */
export function useBatchmates(enabled = true) {
  const fn = useCallback(
    () => (enabled ? getBatchmates() : Promise.resolve(null)),
    [enabled]
  );
  return useAsync(fn);
}


// Convenience: load everything the AnalyticsPage needs in one call.


/**
 * @param {{ isAuthenticated: boolean }} options
 */
export function useAnalyticsDashboard({ isAuthenticated = false } = {}) {
  const summary   = useSummary();
  const trending  = useTrending(10);
  const topViewed = useTopViewed(10);
  const myStats   = useMyStats(isAuthenticated);
  const trend     = useMyStatsTrend(30, isAuthenticated);
  const batchmates = useBatchmates(isAuthenticated);

  return { summary, trending, topViewed, myStats, trend, batchmates };
}