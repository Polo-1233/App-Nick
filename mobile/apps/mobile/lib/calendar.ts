/**
 * Calendar integration layer
 *
 * Handles Expo Calendar API permissions, fetches events, converts to R90 format.
 * Handles recurring events and multi-day events.
 *
 * Write-back (V1.5):
 *   writeSleepBlocksToCalendar() creates "Pre-sleep" and "Sleep window" events
 *   in the user's default calendar for today.
 *   This is idempotent — events are only created if they don't already exist for today.
 */

import * as Calendar from 'expo-calendar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CalendarEvent, DayPlan } from '@r90/types';

// ─── Calendar source metadata ─────────────────────────────────────────────────

/** Simplified calendar source info shown to the user. */
export interface CalendarSource {
  id:        string;
  name:      string;
  color:     string;       // hex color from the OS
  source:    string;       // e.g. "iCloud", "Google", "Exchange", "Local"
  isDefault: boolean;
}

// ─── Selected calendars storage ───────────────────────────────────────────────

const CALENDAR_KEYS = {
  SELECTED_IDS:    '@r90:calendar:selectedIds:v1',
  LAST_WRITTEN:    '@r90:calendar:lastWritten:v1',
  WRITE_BACK_ID:   '@r90:calendar:writeBackId:v1',
} as const;

/**
 * Return all available calendar sources on the device.
 * Requires calendar permission to be granted.
 */
export async function getAvailableCalendars(): Promise<CalendarSource[]> {
  try {
    if (!(await hasCalendarPermission())) return [];
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    return calendars.map(cal => ({
      id:        cal.id,
      name:      cal.title,
      color:     cal.color ?? '#22C55E',
      source:    cal.source?.name ?? 'Device',
      isDefault: cal.isPrimary ?? false,
    }));
  } catch {
    return [];
  }
}

/**
 * Load the user's selected calendar IDs from storage.
 * Returns null if the user has never configured a selection
 * (meaning: use all calendars by default).
 */
export async function loadSelectedCalendarIds(): Promise<string[] | null> {
  try {
    const raw = await AsyncStorage.getItem(CALENDAR_KEYS.SELECTED_IDS);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Persist the user's selected calendar IDs.
 * Pass null to reset to "all calendars" default.
 */
export async function saveSelectedCalendarIds(ids: string[] | null): Promise<void> {
  try {
    if (ids === null) {
      await AsyncStorage.removeItem(CALENDAR_KEYS.SELECTED_IDS);
    } else {
      await AsyncStorage.setItem(CALENDAR_KEYS.SELECTED_IDS, JSON.stringify(ids));
    }
  } catch {
    // non-critical
  }
}

// ─── Write-back calendar preference ──────────────────────────────────────────

/**
 * Load the calendar ID the user wants R90 to write sleep blocks into.
 * Returns null if not set (falls back to first writable calendar).
 */
export async function loadWriteBackCalendarId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(CALENDAR_KEYS.WRITE_BACK_ID);
  } catch {
    return null;
  }
}

/**
 * Persist the preferred write-back calendar ID.
 * Pass null to clear (reverts to auto-select).
 */
export async function saveWriteBackCalendarId(id: string | null): Promise<void> {
  try {
    if (id === null) {
      await AsyncStorage.removeItem(CALENDAR_KEYS.WRITE_BACK_ID);
    } else {
      await AsyncStorage.setItem(CALENDAR_KEYS.WRITE_BACK_ID, id);
    }
  } catch {
    // non-critical
  }
}

/**
 * Return all calendars that can receive write-back events (i.e. allowsModifications).
 */
export async function getWriteableCalendars(): Promise<CalendarSource[]> {
  try {
    if (!(await hasCalendarPermission())) return [];
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    return calendars
      .filter(c => c.allowsModifications)
      .map(cal => ({
        id:        cal.id,
        name:      cal.title,
        color:     cal.color ?? '#22C55E',
        source:    cal.source?.name ?? 'Device',
        isDefault: cal.isPrimary ?? false,
      }));
  } catch {
    return [];
  }
}

/**
 * Request calendar permission from user
 * Returns true if granted, false if denied
 */
export async function requestCalendarPermission(): Promise<boolean> {
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('[calendar] Failed to request permission:', error);
    return false;
  }
}

/**
 * Check if calendar permission is granted
 */
export async function hasCalendarPermission(): Promise<boolean> {
  try {
    const { status } = await Calendar.getCalendarPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('[calendar] Failed to check permission:', error);
    return false;
  }
}

/**
 * Fetch today's calendar events and convert to R90 CalendarEvent format
 * Returns empty array if permission denied or error occurs
 */
export async function fetchTodayEvents(): Promise<CalendarEvent[]> {
  try {
    // Check permission
    const hasPermission = await hasCalendarPermission();
    if (!hasPermission) {
      return [];
    }

    // Get today's date range (midnight to midnight)
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    // Fetch all calendars, then filter to user selection (or all if no selection saved)
    const allCalendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const selectedIds  = await loadSelectedCalendarIds();
    const calendars    = selectedIds
      ? allCalendars.filter(cal => selectedIds.includes(cal.id))
      : allCalendars;

    if (calendars.length === 0) return [];

    // Build a map for quick calendar metadata lookup
    const calendarMeta = new Map(
      calendars.map(cal => [cal.id, {
        sourceName:   cal.source?.name ?? 'Device',
        calendarName: cal.title,
        color:        cal.color ?? '#22C55E',
      }])
    );

    // Fetch events from selected calendars in parallel
    const results = await Promise.allSettled(
      calendars.map(cal => Calendar.getEventsAsync([cal.id], startOfDay, endOfDay))
    );

    // Flatten, tag each event with its calendarId for metadata enrichment
    const taggedEvents: Array<{ event: Calendar.Event; calId: string }> = [];
    calendars.forEach((cal, idx) => {
      const result = results[idx];
      if (result.status === 'fulfilled') {
        result.value.forEach(ev => taggedEvents.push({ event: ev, calId: cal.id }));
      } else {
        console.warn('[calendar] Failed to fetch from calendar:', cal.title);
      }
    });

    // Convert to R90 format + deduplicate by stable event key
    const seen = new Set<string>();
    const r90Events: CalendarEvent[] = [];

    for (const { event, calId } of taggedEvents) {
      // Stable key: use instanceId for recurring events, otherwise id
      // Recurring events have the same .id but different .instanceId per occurrence
      const stableKey = (event as unknown as { instanceId?: string }).instanceId ?? event.id;
      if (seen.has(stableKey)) continue;
      seen.add(stableKey);

      // Skip declined invitations (attending status = 'declined')
      if (isDeclinedInvitation(event)) continue;

      const meta = calendarMeta.get(calId);
      const converted = convertToR90Event(event, startOfDay, meta);
      if (converted) r90Events.push(converted);
    }

    return r90Events;
  } catch (error) {
    console.error('[calendar] Failed to fetch events:', error);
    return [];
  }
}

/**
 * Return true if the event is an invitation the user has declined.
 * expo-calendar exposes attendees on some platforms; we check the self-attendee.
 */
function isDeclinedInvitation(event: Calendar.Event): boolean {
  try {
    // expo-calendar may not expose attendees on all OS versions
    const attendees = (event as unknown as { attendees?: Array<{ isSelf?: boolean; status?: string }> }).attendees;
    if (!attendees) return false;
    const self = attendees.find(a => a.isSelf);
    if (!self) return false;
    // RSVP statuses: 'accepted' | 'declined' | 'tentative' | 'unknown'
    return self.status === 'declined';
  } catch {
    return false;
  }
}

/**
 * Convert Expo Calendar event to R90 CalendarEvent format
 * Handles multi-day events (clips to today only)
 * Returns null if event cannot be converted
 */
function convertToR90Event(
  event: Calendar.Event,
  today: Date,
  meta?: { sourceName: string; calendarName: string; color: string },
): CalendarEvent | null {
  try {
    if (!event.startDate || !event.endDate) return null;

    const startDate = new Date(event.startDate);
    const endDate   = new Date(event.endDate);

    // Clip to today's bounds
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    const todayEnd   = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    const clippedStart = startDate < todayStart ? todayStart : startDate;
    const clippedEnd   = endDate > todayEnd   ? todayEnd   : endDate;

    const startMinutes = clippedStart.getHours() * 60 + clippedStart.getMinutes();
    // For events ending exactly at midnight of the next day, use 1439 (23:59)
    let endMinutes = clippedEnd.getHours() * 60 + clippedEnd.getMinutes();
    if (endMinutes === 0 && clippedEnd > clippedStart) endMinutes = 1439;

    // Skip all-day events and zero-duration events after clipping
    if (event.allDay)                return null;
    if (startMinutes >= endMinutes)  return null;

    return {
      id:           event.id,
      title:        event.title || 'Untitled Event',
      start:        startMinutes,
      end:          endMinutes,
      date:         formatDate(today),
      sourceName:   meta?.sourceName,
      calendarName: meta?.calendarName,
      color:        meta?.color,
    };
  } catch {
    return null;
  }
}

/**
 * Format Date to YYYY-MM-DD
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Fetch events with permission handling
 * Requests permission if not granted, returns empty array if denied
 */
export async function fetchEventsWithPermission(): Promise<CalendarEvent[]> {
  const hasPermission = await hasCalendarPermission();

  if (!hasPermission) {
    const granted = await requestCalendarPermission();
    if (!granted) {
      return [];
    }
  }

  return fetchTodayEvents();
}

// ─── Write-back ───────────────────────────────────────────────────────────────

const WRITEBACK_KEYS = {
  LAST_WRITTEN: CALENDAR_KEYS.LAST_WRITTEN,
} as const;

/**
 * Write "Pre-sleep" and "Sleep window" blocks to the user's default calendar.
 * Idempotent — only writes once per day (tracked via AsyncStorage).
 * Silently skips if permission is not granted.
 *
 * @param plan  - Today's DayPlan (provides preSleepStart, bedtime, anchorTime)
 */
export async function writeSleepBlocksToCalendar(plan: DayPlan): Promise<void> {
  try {
    // Check permission
    if (!(await hasCalendarPermission())) return;

    // Idempotency — only write once per day
    const today = new Date().toISOString().split('T')[0];
    const lastWritten = await AsyncStorage.getItem(WRITEBACK_KEYS.LAST_WRITTEN);
    if (lastWritten === today) return;

    // Find the target write-back calendar
    const calendars       = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const preferredId     = await loadWriteBackCalendarId();
    const writeable       = preferredId
      ? (calendars.find(c => c.id === preferredId && c.allowsModifications)
          ?? calendars.find(c => c.allowsModifications))
      : (calendars.find(c => c.allowsModifications && c.isPrimary)
          ?? calendars.find(c => c.allowsModifications && c.source?.type === 'local')
          ?? calendars.find(c => c.allowsModifications));
    if (!writeable) return;

    // Build Date objects for pre-sleep and sleep window
    function minuteToDateToday(minute: number, allowNextDay = false): Date {
      const d = new Date();
      d.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
      // If time has already passed and next-day is allowed (for anchor = wake time)
      if (allowNextDay && d < new Date()) {
        d.setDate(d.getDate() + 1);
      }
      return d;
    }

    const { preSleepStart, bedtime, wakeTime, cycleCount } = plan.cycleWindow;

    const preSleepDate = minuteToDateToday(preSleepStart);
    const bedtimeDate  = minuteToDateToday(bedtime);
    const wakeDate     = minuteToDateToday(wakeTime, true);

    // Pre-sleep block
    await Calendar.createEventAsync(writeable.id, {
      title:     'Pre-sleep routine',
      notes:     'R90 wind-down window. Step away from screens.',
      startDate: preSleepDate,
      endDate:   bedtimeDate,
      alarms:    [{ relativeOffset: 0 }],
      timeZone:  Intl.DateTimeFormat().resolvedOptions().timeZone,
    });

    // Sleep window block
    await Calendar.createEventAsync(writeable.id, {
      title:     'Sleep window',
      notes:     `R-Lo · Sleep Coach — ${cycleCount} cycles`,
      startDate: bedtimeDate,
      endDate:   wakeDate,
      alarms:    [],
      timeZone:  Intl.DateTimeFormat().resolvedOptions().timeZone,
    });

    await AsyncStorage.setItem(WRITEBACK_KEYS.LAST_WRITTEN, today);
  } catch (e) {
    // Non-critical — log and continue
    console.error('[calendar] writeSleepBlocksToCalendar failed:', e);
  }
}
