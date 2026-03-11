/**
 * CalendarSelector
 *
 * Displays available device calendars with toggle switches.
 * Allows the user to choose which calendars R90 Navigator reads.
 *
 * Used in ProfileScreen Settings section.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Switch,
  ActivityIndicator,
  StyleSheet,
  Pressable,
} from 'react-native';
import {
  getAvailableCalendars,
  loadSelectedCalendarIds,
  saveSelectedCalendarIds,
  type CalendarSource,
} from '../lib/calendar';
import { useTheme } from '../lib/theme-context';

interface Props {
  /** Called after the selection changes so the parent can refresh the day plan. */
  onSelectionChange?: () => void;
}

export function CalendarSelector({ onSelectionChange }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;

  const [calendars,    setCalendars]    = useState<CalendarSource[]>([]);
  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set());
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);

  // ── Load ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [avail, saved] = await Promise.all([
        getAvailableCalendars(),
        loadSelectedCalendarIds(),
      ]);
      setCalendars(avail);
      // Default: all selected
      const initial = saved ? new Set(saved) : new Set(avail.map(c => c.id));
      setSelectedIds(initial);
    } finally {
      setLoading(false);
    }
  }

  // ── Toggle ─────────────────────────────────────────────────────────────────
  const toggle = useCallback(async (id: string, value: boolean) => {
    setSaving(true);
    try {
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (value) {
          next.add(id);
        } else {
          // Never allow zero calendars — keep at least one
          if (next.size > 1) next.delete(id);
        }
        return next;
      });
    } finally {
      setSaving(false);
    }
  }, []);

  // Persist whenever selectedIds changes (debounce via useEffect)
  useEffect(() => {
    if (loading) return;
    void (async () => {
      await saveSelectedCalendarIds([...selectedIds]);
      onSelectionChange?.();
    })();
  }, [selectedIds, loading, onSelectionChange]);

  // ── Group by source ────────────────────────────────────────────────────────
  const grouped = calendars.reduce<Record<string, CalendarSource[]>>((acc, cal) => {
    const key = cal.source;
    if (!acc[key]) acc[key] = [];
    acc[key].push(cal);
    return acc;
  }, {});

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.loader}>
        <ActivityIndicator color={c.textMuted} size="small" />
      </View>
    );
  }

  if (calendars.length === 0) {
    return (
      <View style={s.empty}>
        <Text style={[s.emptyText, { color: c.textFaint }]}>
          No calendars found. Grant calendar access in Settings.
        </Text>
      </View>
    );
  }

  return (
    <View>
      {Object.entries(grouped).map(([sourceName, cals]) => (
        <View key={sourceName} style={s.group}>
          {/* Source header */}
          <Text style={[s.sourceLabel, { color: c.textFaint }]}>
            {sourceName.toUpperCase()}
          </Text>

          {cals.map(cal => {
            const active = selectedIds.has(cal.id);
            return (
              <View
                key={cal.id}
                style={[s.row, { borderBottomColor: c.borderSub }]}
              >
                {/* Color dot */}
                <View style={[s.dot, { backgroundColor: cal.color }]} />

                {/* Calendar name */}
                <Text style={[s.calName, { color: c.text }]} numberOfLines={1}>
                  {cal.name}
                </Text>

                {/* Toggle */}
                <Switch
                  value={active}
                  onValueChange={val => { void toggle(cal.id, val); }}
                  disabled={saving || (active && selectedIds.size === 1)}
                  trackColor={{ false: c.border, true: '#22C55E' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            );
          })}
        </View>
      ))}

      {/* Reset link */}
      <Pressable
        style={s.resetBtn}
        onPress={() => {
          const all = new Set(calendars.map(c => c.id));
          setSelectedIds(all);
        }}
      >
        <Text style={[s.resetText, { color: c.textFaint }]}>
          Select all calendars
        </Text>
      </Pressable>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  loader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  empty: {
    paddingVertical: 16,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 20,
  },
  group: {
    marginBottom: 8,
  },
  sourceLabel: {
    fontSize:      10,
    fontWeight:    '700',
    letterSpacing: 1.5,
    marginBottom:  8,
    marginTop:     12,
  },
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:   12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap:               12,
  },
  dot: {
    width:        10,
    height:       10,
    borderRadius: 5,
    flexShrink:   0,
  },
  calName: {
    flex:       1,
    fontSize:   15,
    fontWeight: '400',
  },
  resetBtn: {
    paddingVertical: 12,
    alignItems:      'center',
  },
  resetText: {
    fontSize: 13,
  },
});
