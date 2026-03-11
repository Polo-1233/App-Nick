/**
 * CalendarTopPills — minimal pill-style header for the Calendar tab.
 *
 * Layout (left → right):
 *   [date pill ▾]   [spacer]   [Today shortcut?]   [Day | 3D | Month]
 *
 * The date pill shows "Today" (green) or "Mar 20 ▾".
 * Tapping it calls onDatePillPress so the parent can open a date picker.
 * The "Today" shortcut only appears when focusedDate ≠ today.
 */

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../lib/theme-context';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ViewMode = '1d' | '3d' | 'month';

interface Props {
  mode:            ViewMode;
  focusedDate:     Date;
  todayStr:        string;
  onDatePillPress: () => void;
  onModeChange:    (m: ViewMode) => void;
  onTodayPress:    () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MODE_LABEL: Record<ViewMode, string> = { '1d': 'Day', '3d': '3D', 'month': 'Month' };

function fmtDatePill(date: Date, todayStr: string): string {
  const isToday = date.toISOString().split('T')[0] === todayStr;
  if (isToday) return 'Today';
  return date.toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

// ─── CalendarTopPills ─────────────────────────────────────────────────────────

export function CalendarTopPills({
  mode, focusedDate, todayStr, onDatePillPress, onModeChange, onTodayPress,
}: Props) {
  const { theme }  = useTheme();
  const isAtToday  = focusedDate.toISOString().split('T')[0] === todayStr;
  const dateLabel  = fmtDatePill(focusedDate, todayStr);
  const pillAccent = isAtToday ? '#22C55E' : theme.colors.text;
  const chevAccent = isAtToday ? '#22C55E' : theme.colors.textSub;

  return (
    <View style={[s.row, { borderBottomColor: theme.colors.border }]}>

      {/* Date pill */}
      <Pressable
        style={[s.datePill, { backgroundColor: theme.colors.surface2 }]}
        onPress={onDatePillPress}
        accessibilityRole="button"
        accessibilityLabel={`Current date: ${dateLabel}. Tap to open date picker.`}
      >
        <Text style={[s.datePillTxt, { color: pillAccent }]}>{dateLabel}</Text>
        <Feather name="chevron-down" size={14} color={chevAccent} />
      </Pressable>

      <View style={s.spacer} />

      {/* Today shortcut — only when not already at today */}
      {!isAtToday && (
        <Pressable
          style={[s.todayBtn, { borderColor: theme.colors.border }]}
          onPress={onTodayPress}
          accessibilityRole="button"
          accessibilityLabel="Jump to today"
        >
          <Text style={[s.todayBtnTxt, { color: theme.colors.textSub }]}>Today</Text>
        </Pressable>
      )}

      {/* Mode pills: Day | 3D | Month */}
      <View style={[s.modePills, { backgroundColor: theme.colors.surface }]}>
        {(['1d', '3d', 'month'] as ViewMode[]).map(m => (
          <Pressable
            key={m}
            style={[
              s.modePill,
              mode === m && [s.modePillActive, { backgroundColor: theme.colors.surface2 }],
            ]}
            onPress={() => onModeChange(m)}
          >
            <Text style={[
              s.modePillTxt,
              { color: mode === m ? theme.colors.text : theme.colors.textMuted },
            ]}>
              {MODE_LABEL[m]}
            </Text>
          </Pressable>
        ))}
      </View>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 12,
    paddingVertical:   10,
    gap:               8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  datePill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               5,
    paddingHorizontal: 14,
    paddingVertical:   8,
    borderRadius:      24,
  },
  datePillTxt: { fontSize: 14, fontWeight: '600' },
  spacer:      { flex: 1 },
  todayBtn: {
    paddingHorizontal: 10,
    paddingVertical:   5,
    borderRadius:      12,
    borderWidth:       1,
  },
  todayBtnTxt: { fontSize: 12, fontWeight: '500' },
  modePills: {
    flexDirection: 'row',
    borderRadius:  10,
    padding:       2,
    gap:           1,
  },
  modePill: {
    paddingHorizontal: 10,
    paddingVertical:   5,
    borderRadius:      8,
  },
  modePillActive: {},
  modePillTxt: { fontSize: 11, fontWeight: '700' },
});
