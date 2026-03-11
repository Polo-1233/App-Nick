/**
 * WriteBackCalendarPicker
 *
 * Lets the user choose which calendar receives the R90 sleep blocks
 * (pre-sleep routine + sleep window events).
 *
 * Shows only writable calendars. Defaults to system-selected if none chosen.
 * Used in ProfileScreen Settings → Calendars section.
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import {
  getWriteableCalendars,
  loadWriteBackCalendarId,
  saveWriteBackCalendarId,
  type CalendarSource,
} from '../lib/calendar';
import { useTheme } from '../lib/theme-context';

export function WriteBackCalendarPicker() {
  const { theme } = useTheme();
  const c = theme.colors;

  const [calendars,    setCalendars]    = useState<CalendarSource[]>([]);
  const [selectedId,   setSelectedId]   = useState<string | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [sheetOpen,    setSheetOpen]    = useState(false);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const [avail, saved] = await Promise.all([
      getWriteableCalendars(),
      loadWriteBackCalendarId(),
    ]);
    setCalendars(avail);
    setSelectedId(saved);
    setLoading(false);
  }

  async function pick(id: string | null) {
    setSelectedId(id);
    await saveWriteBackCalendarId(id);
    setSheetOpen(false);
  }

  const selected = calendars.find(c => c.id === selectedId);
  const displayName = selected
    ? `${selected.name} · ${selected.source}`
    : 'Auto (system default)';

  if (loading) {
    return (
      <View style={s.row}>
        <Text style={[s.label, { color: c.text }]}>Write sleep blocks to</Text>
        <ActivityIndicator size="small" color={c.textMuted} />
      </View>
    );
  }

  if (calendars.length === 0) return null;

  return (
    <>
      <Pressable
        style={[s.row, { borderBottomColor: c.borderSub }]}
        onPress={() => setSheetOpen(true)}
      >
        <View style={s.rowLeft}>
          <Text style={[s.label, { color: c.text }]}>Write sleep blocks to</Text>
          <Text style={[s.value, { color: c.textMuted }]} numberOfLines={1}>
            {displayName}
          </Text>
        </View>
        <Text style={[s.chevron, { color: c.textFaint }]}>›</Text>
      </Pressable>

      {/* Picker modal */}
      <Modal
        visible={sheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetOpen(false)}
      >
        <Pressable style={s.backdrop} onPress={() => setSheetOpen(false)} />
        <View style={[s.sheet, { backgroundColor: theme.colors.surface ?? '#1A1A1A' }]}>
          <View style={s.handle} />
          <Text style={[s.sheetTitle, { color: c.text }]}>Write sleep blocks to</Text>
          <Text style={[s.sheetSubtitle, { color: c.textMuted }]}>
            R90 Navigator will create Pre-sleep and Sleep window events in this calendar.
          </Text>
          <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
            {/* Auto option */}
            <Pressable
              style={[s.option, { borderBottomColor: c.borderSub }]}
              onPress={() => { void pick(null); }}
            >
              <View style={[s.optionDot, { backgroundColor: '#6B7280' }]} />
              <View style={s.optionInfo}>
                <Text style={[s.optionName, { color: c.text }]}>Auto (system default)</Text>
                <Text style={[s.optionSource, { color: c.textFaint }]}>Let R90 choose automatically</Text>
              </View>
              {selectedId === null && <Text style={s.checkmark}>✓</Text>}
            </Pressable>

            {/* Calendar options */}
            {calendars.map(cal => (
              <Pressable
                key={cal.id}
                style={[s.option, { borderBottomColor: c.borderSub }]}
                onPress={() => { void pick(cal.id); }}
              >
                <View style={[s.optionDot, { backgroundColor: cal.color }]} />
                <View style={s.optionInfo}>
                  <Text style={[s.optionName, { color: c.text }]}>{cal.name}</Text>
                  <Text style={[s.optionSource, { color: c.textFaint }]}>{cal.source}</Text>
                </View>
                {selectedId === cal.id && <Text style={s.checkmark}>✓</Text>}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:   14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap:               8,
  },
  rowLeft: {
    flex: 1,
  },
  label: {
    fontSize:   15,
    fontWeight: '500',
  },
  value: {
    fontSize:  12,
    marginTop:  2,
  },
  chevron: {
    fontSize: 20,
    lineHeight: 22,
  },
  // ── Sheet
  backdrop: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position:            'absolute',
    bottom:              0,
    left:                0,
    right:               0,
    borderTopLeftRadius:  22,
    borderTopRightRadius: 22,
    paddingHorizontal:    20,
    paddingBottom:        40,
    maxHeight:           '60%',
  },
  handle: {
    width:           40,
    height:          4,
    borderRadius:    2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf:       'center',
    marginTop:       10,
    marginBottom:    20,
  },
  sheetTitle: {
    fontSize:     18,
    fontWeight:   '700',
    marginBottom:  6,
  },
  sheetSubtitle: {
    fontSize:     13,
    lineHeight:   20,
    marginBottom: 16,
  },
  scroll: {
    flexGrow: 0,
  },
  option: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:   14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap:               12,
  },
  optionDot: {
    width:        10,
    height:       10,
    borderRadius:  5,
    flexShrink:    0,
  },
  optionInfo: {
    flex: 1,
  },
  optionName: {
    fontSize:   15,
    fontWeight: '400',
  },
  optionSource: {
    fontSize:  12,
    marginTop:  2,
  },
  checkmark: {
    color:      '#22C55E',
    fontSize:   17,
    fontWeight: '700',
  },
});
