/**
 * CalendarSyncStatus
 *
 * Compact status bar shown in ProfileScreen Settings → Calendars section.
 * Displays:
 *   - Native calendar: number of active calendars selected
 *   - Google Calendar: connected email or "Not connected"
 *   - Last write-back: "Today" / "Never"
 *
 * Purely informational — no actions here (actions are in the rows above).
 */

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getGoogleConnectionState } from '../lib/google-calendar';
import { loadSelectedCalendarIds, getAvailableCalendars } from '../lib/calendar';
import { useTheme } from '../lib/theme-context';
import type { ThemeColors } from '../lib/theme';

interface SyncState {
  nativeCount:    number;   // selected device calendars
  totalNative:    number;   // total available
  googleEmail:    string | null;
  lastWriteBack:  string | null;  // ISO date string or null
  loading:        boolean;
}

const LAST_WRITTEN_KEY = '@r90:calendar:lastWritten:v1';

export function CalendarSyncStatus() {
  const { theme } = useTheme();
  const c = theme.colors;

  const [state, setState] = useState<SyncState>({
    nativeCount:   0,
    totalNative:   0,
    googleEmail:   null,
    lastWriteBack: null,
    loading:       true,
  });

  useEffect(() => { void load(); }, []);

  async function load() {
    const [available, saved, googleState, lastWritten] = await Promise.all([
      getAvailableCalendars(),
      loadSelectedCalendarIds(),
      getGoogleConnectionState(),
      AsyncStorage.getItem(LAST_WRITTEN_KEY).catch(() => null),
    ]);
    const nativeCount = saved ? saved.length : available.length;
    setState({
      nativeCount,
      totalNative:   available.length,
      googleEmail:   googleState.email,
      lastWriteBack: lastWritten,
      loading:       false,
    });
  }

  if (state.loading) return null;

  const today = new Date().toISOString().split('T')[0];
  const writeBackLabel = !state.lastWriteBack
    ? 'Never'
    : state.lastWriteBack === today
      ? 'Today ✓'
      : state.lastWriteBack;

  return (
    <View style={[s.container, { borderColor: c.borderSub, backgroundColor: c.surface }]}>
      <Text style={[s.heading, { color: c.textFaint }]}>SYNC STATUS</Text>

      <Row
        label="Device calendars"
        value={`${state.nativeCount} / ${state.totalNative} selected`}
        ok={state.nativeCount > 0}
        c={c}
      />
      <Row
        label="Google Calendar"
        value={state.googleEmail ?? 'Not connected'}
        ok={!!state.googleEmail}
        c={c}
      />
      <Row
        label="Sleep blocks written"
        value={writeBackLabel}
        ok={state.lastWriteBack === today}
        last
        c={c}
      />
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface RowProps {
  label: string;
  value: string;
  ok:    boolean;
  last?: boolean;
  c:     ThemeColors;
}

function Row({ label, value, ok, last, c }: RowProps) {
  return (
    <View style={[s.row, !last && { borderBottomColor: c.borderSub, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <Text style={[s.label, { color: c.textMuted }]}>{label}</Text>
      <View style={s.valueRow}>
        <View style={[s.dot, { backgroundColor: ok ? '#22C55E' : '#6B7280' }]} />
        <Text style={[s.value, { color: ok ? c.text : c.textFaint }]} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    borderWidth:  1,
    borderRadius: 12,
    padding:      14,
    marginTop:    16,
  },
  heading: {
    fontSize:      10,
    fontWeight:    '700',
    letterSpacing: 1.5,
    marginBottom:  12,
  },
  row: {
    paddingVertical: 10,
  },
  label: {
    fontSize:     12,
    marginBottom:  4,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  dot: {
    width:        6,
    height:       6,
    borderRadius: 3,
  },
  value: {
    fontSize:   14,
    fontWeight: '500',
    flex:       1,
  },
});
