/**
 * Calendar sync — pushes device calendar events to the backend
 *
 * Syncs events for the next 7 days from Apple and Google calendars.
 * Throttled to once every 30 minutes via AsyncStorage.
 * Silently catches all errors — never throws.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Calendar from 'expo-calendar';
import * as SecureStore from 'expo-secure-store';
import { hasCalendarPermission, loadSelectedCalendarIds } from './calendar';
import { getGoogleConnectionState } from './google-calendar';
import { BASE_URL } from './api';
import { getAccessToken } from './supabase';

const SYNC_KEY    = '@r90:lastCalendarSync';
const THROTTLE_MS = 30 * 60 * 1000; // 30 minutes

interface SyncEvent {
  external_id: string;
  title:       string;
  start_time:  string;
  end_time:    string;
  all_day:     boolean;
  source:      'apple' | 'google';
}

export async function syncCalendarToBackend(): Promise<void> {
  try {
    // Check throttle
    const lastSync = await AsyncStorage.getItem(SYNC_KEY);
    if (lastSync && Date.now() - parseInt(lastSync, 10) < THROTTLE_MS) return;

    const events: SyncEvent[] = [];

    // ─── Apple Calendar ────────────────────────────────────────────────────
    if (await hasCalendarPermission()) {
      const now   = new Date();
      const later = new Date(now.getTime() + 7 * 86_400_000);

      const allCalendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const selectedIds  = await loadSelectedCalendarIds();
      const calendars    = selectedIds
        ? allCalendars.filter(c => selectedIds.includes(c.id))
        : allCalendars;

      const results = await Promise.allSettled(
        calendars.map(c => Calendar.getEventsAsync([c.id], now, later)),
      );

      const seen = new Set<string>();
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.status !== 'fulfilled') continue;
        for (const ev of r.value) {
          const key = (ev as unknown as { instanceId?: string }).instanceId ?? ev.id;
          if (seen.has(key)) continue;
          seen.add(key);
          if (!ev.startDate || !ev.endDate) continue;
          events.push({
            external_id: key,
            title:       ev.title || 'Untitled',
            start_time:  new Date(ev.startDate).toISOString(),
            end_time:    new Date(ev.endDate).toISOString(),
            all_day:     ev.allDay ?? false,
            source:      'apple',
          });
        }
      }
    }

    // ─── Google Calendar ───────────────────────────────────────────────────
    const googleState = await getGoogleConnectionState();
    if (googleState.connected) {
      try {
        const token = await SecureStore.getItemAsync('r90:google:access_token');
        if (token) {
          const now   = new Date();
          const later = new Date(now.getTime() + 7 * 86_400_000);
          const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
          url.searchParams.set('timeMin',      now.toISOString());
          url.searchParams.set('timeMax',      later.toISOString());
          url.searchParams.set('singleEvents', 'true');
          url.searchParams.set('orderBy',      'startTime');
          url.searchParams.set('maxResults',   '200');

          const resp = await fetch(url.toString(), {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (resp.ok) {
            const data: {
              items?: Array<{
                id: string;
                summary?: string;
                start: { dateTime?: string; date?: string };
                end:   { dateTime?: string; date?: string };
              }>;
            } = await resp.json();

            for (const item of data.items ?? []) {
              const startStr = item.start.dateTime ?? item.start.date;
              const endStr   = item.end.dateTime ?? item.end.date;
              if (!startStr || !endStr) continue;
              events.push({
                external_id: `google:${item.id}`,
                title:       item.summary ?? 'Untitled',
                start_time:  new Date(startStr).toISOString(),
                end_time:    new Date(endStr).toISOString(),
                all_day:     !item.start.dateTime,
                source:      'google',
              });
            }
          }
        }
      } catch {
        // Google sync failure is non-critical
      }
    }

    if (events.length === 0) {
      await AsyncStorage.setItem(SYNC_KEY, String(Date.now()));
      return;
    }

    // POST to backend
    const accessToken = await getAccessToken();
    if (!accessToken) return;

    await fetch(`${BASE_URL}/calendar/sync`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ events: events.slice(0, 200) }),
    });

    await AsyncStorage.setItem(SYNC_KEY, String(Date.now()));
  } catch {
    // Silent failure — calendar sync is non-critical
  }
}
