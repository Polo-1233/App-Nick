/**
 * Calendar tab — Google-Calendar-inspired Energy view (redesigned).
 *
 * Header: CalendarTopPills (minimal pill-style, no heavy bar)
 *   • Date pill (left) → taps open native date picker
 *   • Today shortcut  → appears when focusedDate ≠ today
 *   • Mode pills (right): Day | 3D | Month
 *
 * Day / 3D view: DayPager (swipe left/right to change day)
 *   • Horizontal swipe changes day (inner pager takes gesture priority)
 *   • Long-press arrow nav still works via CalendarTopPills callbacks
 *
 * Month view: MonthGrid — tap a day to jump into Day view
 *
 * FAB "+" → AddEventSheet for creating events
 *
 * Three modes:
 *   '1d'    — vertical 24-hour grid for the focused day
 *   '3d'    — three adjacent day columns
 *   'month' — full month grid
 */

import {
  useEffect,
  useMemo,
  useState,
  useCallback,
} from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { generateConflictOptions } from '@r90/core';
import type {
  TimeBlock,
  Conflict,
  ConflictOption,
  UserProfile,
  NightRecord,
  ReadinessZone,
} from '@r90/types';
import { useDayPlanContext } from '../../lib/day-plan-context';
import { getDayPlanPayload, type DayPlanPayload } from '../../lib/api';
import { usePremium } from '../../lib/use-premium';
import { loadProfile, loadWeekHistory } from '../../lib/storage';
import { useTheme } from '../../lib/theme-context';
import { CalendarSkeletonScreen } from '../SkeletonLoader';
import { BottomAdviceBanner } from '../BottomAdviceBanner';
import { PremiumGate } from '../PremiumGate';
import { EventSheet } from '../calendar/EventSheet';
import { CalendarTopPills, type ViewMode } from '../calendar/CalendarTopPills';
import { DayPager, type PagerMode } from '../calendar/DayPager';
import { MonthGrid } from '../calendar/MonthGrid';
import { AddEventSheet } from '../calendar/AddEventSheet';

// ─── Constants ────────────────────────────────────────────────────────────────

/** BottomAdviceBanner approximate height (card ~72 px + 8 px gap). */
const BANNER_H  = 80;
/** FAB diameter. */
const FAB_SIZE  = 56;

// ─── Types ────────────────────────────────────────────────────────────────────

interface SelectedBlock {
  block:    TimeBlock;
  conflict: Conflict | undefined;
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function toDateStr(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getCurrentMinute(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function phantomBlocks(profile: UserProfile): TimeBlock[] {
  const bedtime  = ((profile.anchorTime - profile.idealCyclesPerNight * 90) + 1440) % 1440;
  const preSleep = ((bedtime - 90) + 1440) % 1440;
  return [
    { start: preSleep, end: bedtime,            type: 'pre_sleep',   label: 'Pre-sleep' },
    { start: bedtime,  end: profile.anchorTime, type: 'sleep_cycle', label: `${profile.idealCyclesPerNight}c target` },
  ];
}

function getAdviceMessage(zone?: ReadinessZone): string {
  if (zone === 'green')  return 'Looking good. Protect your pre-sleep window tonight.';
  if (zone === 'yellow') return 'Stay consistent with your anchor to rebuild rhythm.';
  if (zone === 'orange') return 'Focus on hitting your anchor time — consistency is the reset.';
  return 'Keep your anchor time fixed and let the cycles do the rest.';
}

// ─── CalendarScreen ───────────────────────────────────────────────────────────

export default function CalendarScreen() {
  const { theme }   = useTheme();
  const { dayPlan, loading, applyConflictOption } = useDayPlanContext();
  const { checkGate, recordUsage } = usePremium();

  // ── Backend day plan (enriched timeline from nick_brain) ───────────────────
  const [backendPlan,      setBackendPlan]      = useState<DayPlanPayload | null>(null);
  const [backendPlanLoaded, setBackendPlanLoaded] = useState(false);

  useEffect(() => {
    getDayPlanPayload().then(result => {
      if (result.ok && result.data) setBackendPlan(result.data);
      setBackendPlanLoaded(true);
    });
  }, []);

  // ── View state ──────────────────────────────────────────────────────────────

  const [viewMode,    setViewMode]    = useState<ViewMode>('1d');
  const [focusedDate, setFocusedDate] = useState(() => new Date());
  const [profile,     setProfile]     = useState<UserProfile | null>(null);
  const [weekHistory, setWeekHistory] = useState<NightRecord[]>([]);

  // ── Sheet / modal state ─────────────────────────────────────────────────────

  const [selected,      setSelected]      = useState<SelectedBlock | null>(null);
  const [selOptions,    setSelOptions]    = useState<Record<string, number>>({});
  const [showGate,      setShowGate]      = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showAddEvent,  setShowAddEvent]  = useState(false);

  // ── Derived ─────────────────────────────────────────────────────────────────

  const todayStr   = toDateStr(new Date());
  const currentMin = getCurrentMinute();
  const zone       = dayPlan?.readiness.zone ?? null;

  const todayCycles  = dayPlan?.readiness.recentCycles[0];
  const adviceMsg    = useMemo(() => getAdviceMessage(zone ?? undefined), [zone]);

  // ── Load static data once ───────────────────────────────────────────────────

  useEffect(() => {
    loadProfile().then(p  => { if (p) setProfile(p); });
    loadWeekHistory().then(h => setWeekHistory(h));
  }, []);

  // ── Navigation ──────────────────────────────────────────────────────────────

  const goToday = useCallback(() => setFocusedDate(new Date()), []);

  const handleModeChange = useCallback((m: ViewMode) => {
    setViewMode(m);
    setFocusedDate(new Date());
  }, []);

  // ── Block data ──────────────────────────────────────────────────────────────

  // Convert backend cycle timeline to TimeBlocks for display
  const backendBlocks = useMemo((): TimeBlock[] => {
    if (!backendPlan) return [];
    const hhmm = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return (h ?? 0) * 60 + (m ?? 0);
    };
    const blocks: TimeBlock[] = [];
    const tl = backendPlan.cycle_timeline;
    for (let i = 0; i < tl.length; i++) {
      const entry = tl[i]!;
      const nextEntry = tl[i + 1];
      const startMin = hhmm(entry.time);
      const endMin   = nextEntry ? hhmm(nextEntry.time) : (startMin + 90) % 1440;
      if (entry.type === 'sleep_onset') {
        blocks.push({ start: startMin, end: hhmm(backendPlan.crp_window.open), type: 'sleep_cycle', label: entry.label });
      } else if (entry.is_crp_window) {
        blocks.push({ start: startMin, end: endMin, type: 'crp', label: 'CRP window' });
      } else if (entry.type === 'arp') {
        blocks.push({ start: startMin, end: endMin, type: 'wake', label: 'ARP — Wake' });
      } else if (entry.type === 'mrm') {
        blocks.push({ start: startMin, end: endMin, type: 'down_period', label: `MRM C${entry.cycle}` });
      } else if (entry.type === 'phase_boundary') {
        blocks.push({ start: startMin, end: endMin, type: 'free', label: `Phase ${entry.phase}` });
      }
    }
    // Pre-sleep block
    const sleepOnset = hhmm(backendPlan.sleep_onset['5cycle']);
    const preSleep   = ((sleepOnset - 90) + 1440) % 1440;
    blocks.push({ start: preSleep, end: sleepOnset, type: 'pre_sleep', label: 'Pre-sleep' });
    return blocks;
  }, [backendPlan]);

  const getBlocksForDate = useCallback(
    (date: Date): { blocks: TimeBlock[]; conflicts: Conflict[] } => {
      if (toDateStr(date) === todayStr && dayPlan) {
        // Prefer backend blocks when available (richer 16-cycle timeline)
        const blocks = backendBlocks.length > 0 ? backendBlocks : dayPlan.blocks;
        return { blocks, conflicts: dayPlan.conflicts };
      }
      if (profile) return { blocks: phantomBlocks(profile), conflicts: [] };
      return { blocks: [], conflicts: [] };
    },
    [dayPlan, backendBlocks, profile, todayStr],
  );

  // ── Event handlers ──────────────────────────────────────────────────────────

  const handleBlockPress = useCallback(
    (block: TimeBlock, conflict: Conflict | undefined) => setSelected({ block, conflict }),
    [],
  );

  const handleSelectOption = useCallback(
    (index: number, option: ConflictOption) => {
      if (!selected?.conflict) return;
      if (checkGate('conflict')) { setShowGate(true); return; }
      const eventId = selected.conflict.event.id;
      setSelOptions(prev => ({ ...prev, [eventId]: index }));
      applyConflictOption(option.adjustedPlan);
      recordUsage('conflict');
    },
    [selected, checkGate, applyConflictOption, recordUsage],
  );

  // Date picker (native system dialog on Android)
  function handleDatePickerChange(_evt: DateTimePickerEvent, date?: Date) {
    setShowDatePicker(false);
    if (date) setFocusedDate(date);
  }

  // Add event (V1: no-op save — persisting to device calendar is V2)
  function handleSaveEvent(_title: string, _startMin: number, _endMin: number) {
    // TODO V2: persist to expo-calendar
  }

  // ── Conflict options ─────────────────────────────────────────────────────────

  const conflictOpts: ConflictOption[] = useMemo(() => {
    if (!selected?.conflict || !profile) return [];
    return generateConflictOptions(selected.conflict, profile);
  }, [selected, profile]);

  const selOptIdx = selected?.conflict
    ? (selOptions[selected.conflict.event.id] ?? null)
    : null;

  // ── Loading guard ────────────────────────────────────────────────────────────

  if (loading || !dayPlan) return <CalendarSkeletonScreen />;

  // ── FAB position ─────────────────────────────────────────────────────────────
  // CalendarScreen fills the space above the tab bar (the pager handles that).
  // BANNER_H (≈ 80 px) accounts for the BottomAdviceBanner floating above the tab bar.
  const fabBottom = BANNER_H + 12;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>

      {/* ─── Top pills header (safe-area top) ─── */}
      <SafeAreaView
        style={{ backgroundColor: theme.colors.background }}
        edges={['top']}
      >
        <CalendarTopPills
          mode={viewMode}
          focusedDate={focusedDate}
          todayStr={todayStr}
          onDatePillPress={() => setShowDatePicker(true)}
          onModeChange={handleModeChange}
          onTodayPress={goToday}
        />
      </SafeAreaView>

      {/* ─── Content area ─── */}
      <View style={styles.content}>
        {viewMode === 'month' ? (
          <MonthGrid
            focusedDate={focusedDate}
            weekHistory={weekHistory}
            todayStr={todayStr}
            todayCycles={todayCycles}
            todayZone={zone ?? undefined}
            todayHasConflict={dayPlan.conflicts.length > 0}
            onDayTap={date => {
              setFocusedDate(date);
              setViewMode('1d');
            }}
          />
        ) : (
          <DayPager
            mode={viewMode as PagerMode}
            focusedDate={focusedDate}
            todayStr={todayStr}
            currentMin={currentMin}
            zone={zone}
            getBlocksForDate={getBlocksForDate}
            onBlockPress={handleBlockPress}
            onDateChange={setFocusedDate}
          />
        )}
      </View>

      {/* ─── Bottom advice banner ─── */}
      <BottomAdviceBanner message={adviceMsg} />

      {/* ─── FAB "+" (Google Calendar style) ─── */}
      <View
        style={[styles.fabWrap, { bottom: fabBottom }]}
        pointerEvents="box-none"
      >
        <Pressable
          style={styles.fab}
          onPress={() => setShowAddEvent(true)}
          accessibilityRole="button"
          accessibilityLabel="Add event"
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* ─── Native date picker (Android: system dialog) ─── */}
      {showDatePicker && (
        <DateTimePicker
          value={focusedDate}
          mode="date"
          is24Hour
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={handleDatePickerChange}
        />
      )}

      {/* ─── EventSheet (block detail + conflict resolution) ─── */}
      <EventSheet
        visible={selected !== null}
        block={selected?.block ?? null}
        conflict={selected?.conflict ?? null}
        conflictOptions={conflictOpts}
        selectedOptionIndex={selOptIdx}
        onSelectOption={handleSelectOption}
        onClose={() => setSelected(null)}
      />

      {/* ─── AddEventSheet ─── */}
      <AddEventSheet
        visible={showAddEvent}
        onClose={() => setShowAddEvent(false)}
        onSave={handleSaveEvent}
      />

      {/* ─── PremiumGate ─── */}
      <PremiumGate
        visible={showGate}
        featureName="Conflict Resolution"
        onClose={() => setShowGate(false)}
      />

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    // backgroundColor injected from theme
  },
  content: {
    flex:          1,
    // Bottom padding ensures grid content clears the floating banner + tab bar.
    // 88 px = TAB_BAR_H(54) + banner gap(8) + banner card(~72) simplified to ~88.
    paddingBottom: 88,
  },
  fabWrap: {
    position: 'absolute',
    right:    20,
    // bottom injected dynamically (above banner)
  },
  fab: {
    width:           FAB_SIZE,
    height:          FAB_SIZE,
    borderRadius:    FAB_SIZE / 2,
    backgroundColor: '#22C55E',
    alignItems:      'center',
    justifyContent:  'center',
    // Android elevation
    elevation: 8,
    // iOS shadow
    shadowColor:   '#22C55E',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius:  12,
  },
});
