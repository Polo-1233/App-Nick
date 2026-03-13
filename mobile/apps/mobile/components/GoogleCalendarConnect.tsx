/**
 * GoogleCalendarConnect
 *
 * Settings row that shows the Google Calendar connection state
 * and allows the user to connect or disconnect.
 *
 * Used in ProfileScreen Settings section.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { showRLoToast } from './RLoToast';
import {
  getGoogleConnectionState,
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  type GoogleConnectionState,
} from '../lib/google-calendar';
import { useTheme } from '../lib/theme-context';

interface Props {
  /** Called after connect/disconnect so the parent can refresh the day plan. */
  onConnectionChange?: () => void;
}

export function GoogleCalendarConnect({ onConnectionChange }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;

  const [state,    setState]    = useState<GoogleConnectionState>({ connected: false, email: null });
  const [loading,  setLoading]  = useState(true);
  const [working,  setWorking]  = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const s = await getGoogleConnectionState();
    setState(s);
    setLoading(false);
  }

  const handleConnect = useCallback(async () => {
    setWorking(true);
    try {
      const result = await connectGoogleCalendar();
      if (result.ok) {
        await load();
        onConnectionChange?.();
      } else if (result.error !== 'cancelled') {
        showRLoToast("I couldn't connect to your calendar. Please try again.");
      }
    } finally {
      setWorking(false);
    }
  }, [onConnectionChange]);

  const handleDisconnect = useCallback(() => {
    Alert.alert(
      'Disconnect Google Calendar',
      'R90 Navigator will no longer read your Google Calendar events.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            setWorking(true);
            try {
              await disconnectGoogleCalendar();
              setState({ connected: false, email: null });
              onConnectionChange?.();
            } finally {
              setWorking(false);
            }
          },
        },
      ],
    );
  }, [onConnectionChange]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={s.row}>
        <GoogleLogo />
        <Text style={[s.label, { color: c.text }]}>Google Calendar</Text>
        <ActivityIndicator size="small" color={c.textMuted} />
      </View>
    );
  }

  if (state.connected) {
    return (
      <View style={[s.row, { borderBottomColor: c.borderSub }]}>
        <GoogleLogo />
        <View style={s.info}>
          <Text style={[s.label, { color: c.text }]}>Google Calendar</Text>
          <Text style={[s.email, { color: c.textMuted }]}>{state.email}</Text>
        </View>
        <Pressable
          style={s.disconnectBtn}
          onPress={handleDisconnect}
          disabled={working}
        >
          {working
            ? <ActivityIndicator size="small" color="#EF4444" />
            : <Text style={s.disconnectText}>Disconnect</Text>
          }
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[s.row, { borderBottomColor: c.borderSub }]}>
      <GoogleLogo />
      <Text style={[s.label, { color: c.text }]}>Google Calendar</Text>
      <Pressable
        style={s.connectBtn}
        onPress={() => { void handleConnect(); }}
        disabled={working}
      >
        {working
          ? <ActivityIndicator size="small" color="#FFFFFF" />
          : <Text style={s.connectText}>Connect</Text>
        }
      </Pressable>
    </View>
  );
}

// ─── Google logo (colored G) ──────────────────────────────────────────────────

function GoogleLogo() {
  return (
    <View style={s.googleLogo}>
      <Text style={s.googleG}>G</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:   14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap:               12,
  },
  info: {
    flex: 1,
  },
  label: {
    flex:       1,
    fontSize:   15,
    fontWeight: '500',
  },
  email: {
    fontSize: 12,
    marginTop: 2,
  },
  connectBtn: {
    backgroundColor: '#4285F4',
    paddingHorizontal: 14,
    paddingVertical:   8,
    borderRadius:      8,
  },
  connectText: {
    color:      '#FFFFFF',
    fontSize:   13,
    fontWeight: '600',
  },
  disconnectBtn: {
    paddingHorizontal: 10,
    paddingVertical:    6,
    borderRadius:       8,
    backgroundColor:   'rgba(239,68,68,0.12)',
    borderWidth:        1,
    borderColor:       'rgba(239,68,68,0.30)',
  },
  disconnectText: {
    color:      '#EF4444',
    fontSize:   13,
    fontWeight: '600',
  },
  // Google G logo
  googleLogo: {
    width:           28,
    height:          28,
    borderRadius:    14,
    backgroundColor: '#FFFFFF',
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.15)',
  },
  googleG: {
    fontSize:   15,
    fontWeight: '700',
    color:      '#4285F4',
  },
});
