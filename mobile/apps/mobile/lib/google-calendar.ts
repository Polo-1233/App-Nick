/**
 * google-calendar.ts — Google Calendar OAuth2 + API client
 *
 * Flow:
 *   1. User taps "Connect Google Calendar" in Settings
 *   2. connectGoogleCalendar() opens the OAuth2 browser flow
 *   3. Tokens stored securely via expo-secure-store
 *   4. fetchGoogleEvents() reads events directly from Google Calendar API
 *   5. disconnectGoogleCalendar() clears tokens
 *
 * Scopes:
 *   - calendar.readonly   (read events for conflict detection)
 *
 * Token refresh:
 *   - Access token expires in 1h; refreshAccessToken() handles renewal
 *   - refresh_token is persisted and never expires unless revoked
 */

import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import type { CalendarEvent } from '@r90/types';

// Required by expo-auth-session on Android
WebBrowser.maybeCompleteAuthSession();

// ─── Configuration ────────────────────────────────────────────────────────────

// ⚠️  Google requires platform-specific OAuth client IDs for native apps.
//     Web client ID is blocked for mobile OAuth flows since 2023.
//     iOS  → create "iOS application" client in Google Cloud Console → Credentials
//            Bundle ID: com.metalab.r90navigator
//     Android → create "Android application" client → SHA-1 from `eas credentials`
//
// Set these in .env:
//   EXPO_PUBLIC_GOOGLE_CALENDAR_IOS_CLIENT_ID=xxx.apps.googleusercontent.com
//   EXPO_PUBLIC_GOOGLE_CALENDAR_ANDROID_CLIENT_ID=xxx.apps.googleusercontent.com
//   EXPO_PUBLIC_GOOGLE_CALENDAR_WEB_CLIENT_ID=736295281381-cf14o7djr9cge1lsbcpllrim19qvtotu.apps.googleusercontent.com
//
import { Platform } from 'react-native';

const IOS_CLIENT_ID     = process.env.EXPO_PUBLIC_GOOGLE_CALENDAR_IOS_CLIENT_ID     ?? '';
const ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CALENDAR_ANDROID_CLIENT_ID ?? '';
const WEB_CLIENT_ID     = process.env.EXPO_PUBLIC_GOOGLE_CALENDAR_WEB_CLIENT_ID
  ?? '736295281381-cf14o7djr9cge1lsbcpllrim19qvtotu.apps.googleusercontent.com';

const CLIENT_ID = Platform.OS === 'ios'
  ? (IOS_CLIENT_ID     || WEB_CLIENT_ID)
  : (ANDROID_CLIENT_ID || WEB_CLIENT_ID);

const DISCOVERY_DOCUMENT: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint:         'https://oauth2.googleapis.com/token',
  revocationEndpoint:    'https://oauth2.googleapis.com/revoke',
};

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
];

// ─── Secure storage keys ──────────────────────────────────────────────────────

const KEYS = {
  ACCESS_TOKEN:  'r90:google:access_token',
  REFRESH_TOKEN: 'r90:google:refresh_token',
  EXPIRES_AT:    'r90:google:expires_at',
  USER_EMAIL:    'r90:google:email',
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GoogleConnectionState {
  connected: boolean;
  email:     string | null;
}

export interface GoogleAuthResult {
  ok:     boolean;
  error?: string;
}

// ─── Token helpers ────────────────────────────────────────────────────────────

async function saveTokens(
  accessToken:  string,
  refreshToken: string | null,
  expiresIn:    number,
  email:        string,
): Promise<void> {
  const expiresAt = Date.now() + expiresIn * 1000;
  await Promise.all([
    SecureStore.setItemAsync(KEYS.ACCESS_TOKEN,  accessToken),
    SecureStore.setItemAsync(KEYS.EXPIRES_AT,    String(expiresAt)),
    SecureStore.setItemAsync(KEYS.USER_EMAIL,    email),
    refreshToken
      ? SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, refreshToken)
      : Promise.resolve(),
  ]);
}

async function loadAccessToken(): Promise<string | null> {
  try {
    const [token, expiresAtStr, refreshToken] = await Promise.all([
      SecureStore.getItemAsync(KEYS.ACCESS_TOKEN),
      SecureStore.getItemAsync(KEYS.EXPIRES_AT),
      SecureStore.getItemAsync(KEYS.REFRESH_TOKEN),
    ]);

    if (!token) return null;

    // Check expiry (refresh 60s early)
    const expiresAt = Number(expiresAtStr ?? 0);
    if (Date.now() < expiresAt - 60_000) return token;

    // Expired — try refresh
    if (!refreshToken) return null;
    return await refreshAccessToken(refreshToken);
  } catch {
    return null;
  }
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     CLIENT_ID,
        grant_type:    'refresh_token',
        refresh_token: refreshToken,
      }).toString(),
    });
    const data: { access_token?: string; expires_in?: number; error?: string } = await resp.json();
    if (!data.access_token) return null;

    await Promise.all([
      SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, data.access_token),
      SecureStore.setItemAsync(
        KEYS.EXPIRES_AT,
        String(Date.now() + (data.expires_in ?? 3600) * 1000)
      ),
    ]);
    return data.access_token;
  } catch {
    return null;
  }
}

/** Fetch the user's email via Google's tokeninfo endpoint. */
async function fetchUserEmail(accessToken: string): Promise<string> {
  try {
    const resp = await fetch(
      `https://www.googleapis.com/oauth2/v3/userinfo`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const data: { email?: string } = await resp.json();
    return data.email ?? 'Google account';
  } catch {
    return 'Google account';
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Get current Google Calendar connection state.
 */
export async function getGoogleConnectionState(): Promise<GoogleConnectionState> {
  try {
    const [token, email] = await Promise.all([
      SecureStore.getItemAsync(KEYS.ACCESS_TOKEN),
      SecureStore.getItemAsync(KEYS.USER_EMAIL),
    ]);
    return { connected: !!token, email };
  } catch {
    return { connected: false, email: null };
  }
}

/**
 * Start the Google OAuth2 flow.
 * Opens a browser window, asks the user to grant calendar access.
 * Returns ok: true on success.
 */
export async function connectGoogleCalendar(): Promise<GoogleAuthResult> {
  try {
    // iOS: use reverse client ID scheme (com.googleusercontent.apps.xxx)
    // Android: use package name scheme (com.metalab.r90navigator)
    // Google Calendar OAuth redirect URI:
    // Android → reverse of Android client ID (e.g. com.googleusercontent.apps.xxx:/oauth2redirect)
    // iOS     → reverse of iOS client ID
    const activeClientId = Platform.OS === 'ios'
      ? (IOS_CLIENT_ID || WEB_CLIENT_ID)
      : (ANDROID_CLIENT_ID || WEB_CLIENT_ID);

    const reverseClientId = activeClientId.split('.').reverse().join('.');
    const redirectUri = AuthSession.makeRedirectUri({
      scheme: reverseClientId,
      path:   'oauth2redirect',
      native: `${reverseClientId}:/oauth2redirect`,
    });

    const request = new AuthSession.AuthRequest({
      clientId:    CLIENT_ID,
      scopes:      SCOPES,
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      usePKCE:     true,
      extraParams: {
        access_type: 'offline',   // request refresh_token
        prompt:      'consent',   // always show consent (ensures refresh_token returned)
      },
    });

    const result = await request.promptAsync(DISCOVERY_DOCUMENT);

    if (result.type !== 'success') {
      return {
        ok:    false,
        error: result.type === 'cancel' ? 'cancelled' : 'Auth flow failed',
      };
    }

    // Exchange code for tokens
    const tokenResult = await AuthSession.exchangeCodeAsync(
      {
        clientId:     CLIENT_ID,
        code:         result.params.code,
        redirectUri,
        extraParams:  { code_verifier: request.codeVerifier ?? '' },
      },
      DISCOVERY_DOCUMENT,
    );

    if (!tokenResult.accessToken) {
      return { ok: false, error: 'No access token received' };
    }

    const email = await fetchUserEmail(tokenResult.accessToken);

    await saveTokens(
      tokenResult.accessToken,
      tokenResult.refreshToken ?? null,
      tokenResult.expiresIn ?? 3600,
      email,
    );

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Connection failed';
    return { ok: false, error: msg };
  }
}

/**
 * Disconnect Google Calendar — clears all stored tokens.
 */
export async function disconnectGoogleCalendar(): Promise<void> {
  await Promise.allSettled(Object.values(KEYS).map(k => SecureStore.deleteItemAsync(k)));
}

/**
 * Fetch today's events directly from Google Calendar API.
 * Returns empty array if not connected or on error.
 */
export async function fetchGoogleEvents(): Promise<CalendarEvent[]> {
  const accessToken = await loadAccessToken();
  if (!accessToken) return [];

  try {
    const today     = new Date();
    const timeMin   = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    const timeMax   = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    const todayStr  = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

    const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
    url.searchParams.set('timeMin',      timeMin.toISOString());
    url.searchParams.set('timeMax',      timeMax.toISOString());
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy',      'startTime');
    url.searchParams.set('maxResults',   '50');

    const resp = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!resp.ok) return [];

    const data: {
      items?: Array<{
        id: string;
        summary?: string;
        start: { dateTime?: string; date?: string };
        end:   { dateTime?: string; date?: string };
      }>
    } = await resp.json();

    const events: CalendarEvent[] = [];

    for (const item of data.items ?? []) {
      // Skip all-day events
      if (!item.start.dateTime || !item.end.dateTime) continue;

      const start = new Date(item.start.dateTime);
      const end   = new Date(item.end.dateTime);

      const startMin = start.getHours() * 60 + start.getMinutes();
      const endMin   = end.getHours()   * 60 + end.getMinutes();

      if (startMin >= endMin) continue;

      events.push({
        id:           `google:${item.id}`,
        title:        item.summary ?? 'Untitled',
        start:        startMin,
        end:          endMin,
        date:         todayStr,
        sourceName:   'Google',
        calendarName: 'Google Calendar',
        color:        '#4285F4', // Google blue
      });
    }

    return events;
  } catch {
    return [];
  }
}

/**
 * Write pre-sleep and sleep window blocks to the user's primary Google Calendar.
 * Non-critical — silently returns if not connected or on any error.
 *
 * @param preSleepStart  MinuteOfDay when pre-sleep begins
 * @param bedtime        MinuteOfDay when sleep window begins
 * @param wakeTime       MinuteOfDay when the user wakes (may be next day)
 * @param cycleCount     Number of R90 cycles in the window
 */
export async function writeGoogleSleepBlocks(
  preSleepStart: number,
  bedtime:       number,
  wakeTime:      number,
  cycleCount:    number,
): Promise<void> {
  const accessToken = await loadAccessToken();
  if (!accessToken) return;

  try {
    const tz    = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const today = new Date();

    function minuteToISO(minute: number, allowNextDay = false): string {
      const d = new Date(today);
      d.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
      if (allowNextDay && d < new Date()) d.setDate(d.getDate() + 1);
      return d.toISOString();
    }

    const events = [
      {
        summary:     'Pre-sleep routine',
        description: 'R90 wind-down window. Step away from screens.',
        start: { dateTime: minuteToISO(preSleepStart), timeZone: tz },
        end:   { dateTime: minuteToISO(bedtime),        timeZone: tz },
        reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 0 }] },
      },
      {
        summary:     'Sleep window',
        description: `R-Lo · Sleep Coach — ${cycleCount} cycles`,
        start: { dateTime: minuteToISO(bedtime),   timeZone: tz },
        end:   { dateTime: minuteToISO(wakeTime, true), timeZone: tz },
        reminders: { useDefault: false, overrides: [] },
      },
    ];

    await Promise.all(
      events.map(event =>
        fetch(
          'https://www.googleapis.com/calendar/v3/calendars/primary/events',
          {
            method:  'POST',
            headers: {
              Authorization:  `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(event),
          },
        )
      )
    );
  } catch {
    // Non-critical
  }
}
