/**
 * calendar-unified.ts — Unified calendar event layer
 *
 * Single point of truth for fetching ALL calendar events, regardless of source.
 * Aggregates:
 *   - Native device calendars (expo-calendar, user-filtered)
 *   - Google Calendar (OAuth2, if connected)
 *
 * Returns CalendarEvent[] — same type the R90 engine already expects.
 * No source-specific logic leaks past this module.
 */

import type { CalendarEvent } from '@r90/types';
import { fetchEventsWithPermission, fetchTodayEvents } from './calendar';
import { fetchGoogleEvents } from './google-calendar';
import { getMockCalendarEvents } from './mock-calendar-data';

export interface FetchAllEventsOptions {
  /** Use silent fetch (no permission prompt). Defaults to false. */
  silent?: boolean;
}

/**
 * Fetch all events from all connected calendar sources.
 *
 * Merge strategy:
 *   - Native events first (user-selected calendars, filtered)
 *   - Google events appended if no ID collision ('google:' prefix guarantees none)
 *   - Future sources appended the same way
 *
 * Error isolation:
 *   - Each source is fetched independently
 *   - A failure in one source never blocks the others
 */
export async function fetchAllCalendarEvents(
  options: FetchAllEventsOptions = {},
): Promise<CalendarEvent[]> {
  const { silent = false } = options;

  const [nativeResult, googleResult] = await Promise.allSettled([
    silent ? fetchTodayEvents() : fetchEventsWithPermission(),
    fetchGoogleEvents(),
  ]);

  const native: CalendarEvent[] = nativeResult.status === 'fulfilled'
    ? nativeResult.value
    : [];

  const google: CalendarEvent[] = googleResult.status === 'fulfilled'
    ? googleResult.value
    : [];

  // Merge — native IDs never start with 'google:', no collision possible
  const seenIds = new Set(native.map(e => e.id));
  const merged = [
    ...native,
    ...google.filter(e => !seenIds.has(e.id)),
  ];

  // Sort by start time for predictable ordering
  merged.sort((a, b) => a.start - b.start);

  // No real calendar data → fall back to mock for UX testing
  if (merged.length === 0) {
    return getMockCalendarEvents();
  }

  return merged;
}
