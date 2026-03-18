/**
 * Planning tab — R90 Weekly Plan
 *
 * Tonight · This Week · Insights · R90 Score
 * Grounded in R90 methodology.
 */

import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons }    from '@expo/vector-icons';
import { MascotImage } from '../ui/MascotImage';
import { useDayPlanContext } from '../../lib/day-plan-context';
import { loadProfile } from '../../lib/storage';
import type { UserProfile } from '@r90/types';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Analytics } from '../../lib/analytics';

// ─── Design tokens ────────────────────────────────────────────────────────────

const BG        = '#0B1220';
const CARD      = '#1A2436';
const SURFACE   = '#243046';
const ACCENT    = '#4DA3FF';
const TEXT      = '#F0F4FF';
const TEXT_SUB  = '#A0B0CC';
const TEXT_MUTED= '#7A8FAA';
const BORDER    = 'rgba(255,255,255,0.06)';
const GREEN     = '#4ADE80';
const YELLOW    = '#FACC15';
const ORANGE    = '#F97171';
const PURPLE    = '#A78BFA';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function minToHHMM(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function cyclesToDuration(cycles: number): string {
  const totalMin = cycles * 90;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h}h` : `${h}h${m}`;
}

function todayLabel(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

// ─── Weekly plan builder ──────────────────────────────────────────────────────

interface WeekDay {
  dayShort:   string;   // "Mon"
  dayDate:    string;   // "Mar 17"
  isToday:    boolean;
  isPast:     boolean;
  cycles:     number;   // 4 or 5
  bedtimeMin: number;
  wakeMin:    number;
  isRecovery: boolean;  // lighter night (4 cycles)
}

function buildWeek(profile: UserProfile): WeekDay[] {
  const today = new Date();
  const wake  = profile.anchorTime;          // e.g. 450 = 07:30
  const target= profile.idealCyclesPerNight; // e.g. 5

  // R90 pattern: vary cycles across week — not every night is peak
  // Recovery nights (4 cycles) typically fall mid-week and before rest days
  const cyclePattern = [target, target, target - 1, target, target - 1, target, target];

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - today.getDay() + 1 + i); // Mon=0 offset
    const dayShort = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dayDate  = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const todayStr = today.toDateString();
    const isToday  = d.toDateString() === todayStr;
    const isPast   = d < today && !isToday;
    const cycles   = Math.max(1, cyclePattern[i] ?? target);
    const bedtimeMin = ((wake - cycles * 90) + 1440) % 1440;

    return {
      dayShort,
      dayDate,
      isToday,
      isPast,
      cycles,
      bedtimeMin,
      wakeMin: wake,
      isRecovery: cycles < target,
    };
  });
}

// ─── Insight generator ────────────────────────────────────────────────────────

function buildInsights(
  profile: UserProfile,
  recentCycles: number[],
  wearableNote: string | null,
): string[] {
  const insights: string[] = [];

  // Wearable-driven insight (real data)
  if (wearableNote) {
    insights.push(wearableNote);
  }

  // Cycle adherence
  if (recentCycles.length >= 3) {
    const avg = recentCycles.reduce((a, b) => a + b, 0) / recentCycles.length;
    if (avg >= profile.idealCyclesPerNight - 0.3) {
      insights.push(
        `You've averaged ${avg.toFixed(1)} cycles over the last ${recentCycles.length} nights — right on target.`,
      );
    } else {
      const deficit = profile.idealCyclesPerNight - avg;
      insights.push(
        `You're running ${deficit.toFixed(1)} cycles below your target this week. Consider an earlier wind-down tonight.`,
      );
    }
  }

  // Wake time consistency note
  insights.push(
    `Your ARP is ${minToHHMM(profile.anchorTime)}. Keeping your wake time consistent is the single most important R90 habit.`,
  );

  return insights.slice(0, 3);
}

// ─── R90 Score calculator ─────────────────────────────────────────────────────

function calcR90Score(recentCycles: number[], target: number): number {
  if (recentCycles.length === 0) return 0;
  const achieved = recentCycles.reduce((a, b) => a + b, 0);
  const planned  = target * recentCycles.length;
  const adherence = Math.min(1, achieved / planned);
  return Math.round(adherence * 100);
}

function scoreLabel(score: number): { text: string; color: string } {
  if (score >= 85) return { text: 'Excellent adherence',  color: GREEN  };
  if (score >= 65) return { text: 'Good — keep it up',    color: YELLOW };
  return                  { text: 'Needs improvement',    color: ORANGE };
}

// ─── Tonight Card ─────────────────────────────────────────────────────────────

function TonightCard({
  profile,
  adjustedCycles,
  wearableActive,
}: {
  profile:        UserProfile;
  adjustedCycles: number;
  wearableActive: boolean;
}) {
  const wake     = profile.anchorTime;
  const bedtime  = ((wake - adjustedCycles * 90) + 1440) % 1440;
  const winddown = ((bedtime - 90) + 1440) % 1440;
  const latest   = (bedtime + 180) % 1440;

  return (
    <View style={tc.card}>
      {/* Title row */}
      <View style={tc.titleRow}>
        <Text style={tc.title}>Tonight</Text>
        {wearableActive && (
          <View style={tc.wearablePill}>
            <View style={[tc.wearableDot, { backgroundColor: ACCENT }]} />
            <Text style={tc.wearableText}>Wearable adjusted</Text>
          </View>
        )}
      </View>

      {/* Bedtime — hero number */}
      <View style={tc.heroRow}>
        <View>
          <Text style={tc.heroTime}>{minToHHMM(bedtime)}</Text>
          <Text style={tc.heroLabel}>Ideal bedtime</Text>
        </View>
        <View style={tc.cycleBlock}>
          <View style={tc.cyclePills}>
            {Array.from({ length: 5 }).map((_, i) => (
              <View
                key={i}
                style={[tc.cyclePill, i < adjustedCycles && { backgroundColor: ACCENT }]}
              />
            ))}
          </View>
          <Text style={tc.cycleLabel}>
            {adjustedCycles} cycles · {cyclesToDuration(adjustedCycles)}
          </Text>
        </View>
      </View>

      {/* Secondary row */}
      <View style={tc.rowGrid}>
        <View style={tc.rowItem}>
          <Ionicons name="moon-outline" size={14} color={PURPLE} />
          <View>
            <Text style={tc.rowTime}>{minToHHMM(winddown)}</Text>
            <Text style={tc.rowSub}>Wind-down</Text>
          </View>
        </View>
        <View style={tc.divider} />
        <View style={tc.rowItem}>
          <Ionicons name="alert-circle-outline" size={14} color={YELLOW} />
          <View>
            <Text style={[tc.rowTime, { color: YELLOW }]}>{minToHHMM(latest)}</Text>
            <Text style={tc.rowSub}>Latest bedtime</Text>
          </View>
        </View>
        <View style={tc.divider} />
        <View style={tc.rowItem}>
          <Ionicons name="sunny-outline" size={14} color={GREEN} />
          <View>
            <Text style={[tc.rowTime, { color: GREEN }]}>{minToHHMM(wake)}</Text>
            <Text style={tc.rowSub}>Wake up</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const tc = StyleSheet.create({
  card:        { backgroundColor: CARD, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: BORDER, gap: 18 },
  titleRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title:       { fontSize: 13, fontWeight: '700', color: TEXT_MUTED, letterSpacing: 1.2, textTransform: 'uppercase' },
  wearablePill:{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: `${ACCENT}15`, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: `${ACCENT}30` },
  wearableDot: { width: 5, height: 5, borderRadius: 3 },
  wearableText:{ fontSize: 11, fontWeight: '600', color: ACCENT },
  heroRow:     { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  heroTime:    { fontSize: 48, fontWeight: '800', color: TEXT, letterSpacing: -2 },
  heroLabel:   { fontSize: 13, color: TEXT_SUB, marginTop: 2 },
  cycleBlock:  { alignItems: 'flex-end', gap: 6, paddingBottom: 6 },
  cyclePills:  { flexDirection: 'row', gap: 4 },
  cyclePill:   { width: 18, height: 6, borderRadius: 3, backgroundColor: SURFACE },
  cycleLabel:  { fontSize: 12, color: TEXT_SUB },
  rowGrid:     { flexDirection: 'row', alignItems: 'center' },
  rowItem:     { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  divider:     { width: 1, height: 32, backgroundColor: BORDER, marginHorizontal: 8 },
  rowTime:     { fontSize: 15, fontWeight: '700', color: TEXT },
  rowSub:      { fontSize: 11, color: TEXT_MUTED, marginTop: 1 },
});

// ─── This Week ────────────────────────────────────────────────────────────────

function WeekDayCard({ day, isSelected }: { day: WeekDay; isSelected: boolean }) {
  const cycleColor = day.isRecovery ? YELLOW : ACCENT;
  const opacity    = day.isPast ? 0.5 : 1;

  return (
    <View style={[wd.card, isSelected && wd.cardSelected, { opacity }]}>
      <Text style={[wd.dayLabel, isSelected && wd.dayLabelSelected]}>{day.dayShort}</Text>
      <Text style={wd.dateLabel}>{day.dayDate.split(' ')[1]}</Text>

      {/* Cycle dots */}
      <View style={wd.dots}>
        {Array.from({ length: 5 }).map((_, i) => (
          <View
            key={i}
            style={[
              wd.dot,
              i < day.cycles && { backgroundColor: cycleColor },
            ]}
          />
        ))}
      </View>

      {/* Bedtime */}
      <Text style={[wd.time, { color: cycleColor }]}>{minToHHMM(day.bedtimeMin)}</Text>
      <Text style={wd.timeSub}>{day.cycles}c</Text>

      {/* Recovery badge */}
      {day.isRecovery && (
        <View style={wd.recoveryBadge}>
          <Text style={wd.recoveryText}>REC</Text>
        </View>
      )}
    </View>
  );
}

const wd = StyleSheet.create({
  card:            { width: 72, backgroundColor: CARD, borderRadius: 16, padding: 12, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: BORDER },
  cardSelected:    { borderColor: `${ACCENT}60`, backgroundColor: `${ACCENT}10` },
  dayLabel:        { fontSize: 12, fontWeight: '700', color: TEXT_SUB },
  dayLabelSelected:{ color: ACCENT },
  dateLabel:       { fontSize: 10, color: '#8899BB' },
  dots:            { flexDirection: 'row', gap: 2, marginVertical: 4 },
  dot:             { width: 7, height: 7, borderRadius: 4, backgroundColor: SURFACE },
  time:            { fontSize: 13, fontWeight: '700' },
  timeSub:         { fontSize: 10, color: '#8899BB' },
  recoveryBadge:   { backgroundColor: `${YELLOW}20`, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginTop: 2 },
  recoveryText:    { fontSize: 9, fontWeight: '800', color: YELLOW, letterSpacing: 0.5 },
});

// ─── Insight item ─────────────────────────────────────────────────────────────

// Insight 0 — actionable, mis en évidence
function InsightPrimary({ text }: { text: string }) {
  return (
    <View style={ii.primaryCard}>
      <View style={ii.primaryIconWrap}>
        <Ionicons name="flash" size={16} color={YELLOW} />
      </View>
      <View style={ii.primaryBody}>
        <Text style={ii.primaryLabel}>TONIGHT'S ACTION</Text>
        <Text style={ii.primaryText}>{text}</Text>
      </View>
    </View>
  );
}

// Insights 1+ — éducatifs, discrets
function InsightSecondary({ text, index }: { text: string; index: number }) {
  const icons: Array<keyof typeof Ionicons.glyphMap> = ['time-outline', 'information-circle-outline', 'stats-chart-outline'];
  const icon = icons[(index - 1) % icons.length]!;
  return (
    <View style={ii.secRow}>
      <Ionicons name={icon} size={13} color={TEXT_MUTED} style={{ marginTop: 2 }} />
      <Text style={ii.secText}>{text}</Text>
    </View>
  );
}

const ii = StyleSheet.create({
  // Primary
  primaryCard:    { flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: `${YELLOW}10`, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: `${YELLOW}30` },
  primaryIconWrap:{ width: 30, height: 30, borderRadius: 9, backgroundColor: `${YELLOW}20`, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  primaryBody:    { flex: 1, gap: 4 },
  primaryLabel:   { fontSize: 10, fontWeight: '700', color: YELLOW, letterSpacing: 1.1 },
  primaryText:    { fontSize: 14, fontWeight: '500', color: TEXT, lineHeight: 20 },
  // Secondary
  secRow:  { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingHorizontal: 2 },
  secText: { flex: 1, fontSize: 12, color: TEXT_MUTED, lineHeight: 18 },
});

// ─── R90 Score card ───────────────────────────────────────────────────────────

function R90ScoreCard({
  score,
  cycles,
  target,
  nights,
}: {
  score:  number;
  cycles: number;
  target: number;
  nights: number;
}) {
  const widthAnim = useRef(new Animated.Value(0)).current;
  const { text: slabel, color: scolor } = scoreLabel(score);

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: score / 100,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [score, widthAnim]);

  return (
    <View style={sc.card}>
      <View style={sc.topRow}>
        <View>
          <Text style={sc.label}>R90 Score</Text>
          <Text style={sc.sublabel}>Weekly adherence</Text>
        </View>
        <View style={sc.scoreWrap}>
          <Text style={[sc.score, { color: scolor }]}>{score}</Text>
          <Text style={sc.scoreMax}>/100</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={sc.barBg}>
        <Animated.View
          style={[
            sc.barFill,
            {
              backgroundColor: scolor,
              width: widthAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>

      <Text style={[sc.statusText, { color: scolor }]}>{slabel}</Text>

      {/* Stats row */}
      <View style={sc.statsRow}>
        <View style={sc.stat}>
          <Text style={sc.statValue}>{cycles}</Text>
          <Text style={sc.statLabel}>cycles achieved</Text>
        </View>
        <View style={sc.statDivider} />
        <View style={sc.stat}>
          <Text style={sc.statValue}>{target * nights}</Text>
          <Text style={sc.statLabel}>cycles planned</Text>
        </View>
        <View style={sc.statDivider} />
        <View style={sc.stat}>
          <Text style={sc.statValue}>{nights}</Text>
          <Text style={sc.statLabel}>nights tracked</Text>
        </View>
      </View>
    </View>
  );
}

const sc = StyleSheet.create({
  card:       { backgroundColor: CARD, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: BORDER, gap: 14 },
  topRow:     { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  label:      { fontSize: 13, fontWeight: '700', color: TEXT_MUTED, letterSpacing: 1.2, textTransform: 'uppercase' },
  sublabel:   { fontSize: 12, color: TEXT_MUTED, marginTop: 2 },
  scoreWrap:  { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  score:      { fontSize: 42, fontWeight: '800', letterSpacing: -1 },
  scoreMax:   { fontSize: 16, color: TEXT_MUTED, marginBottom: 6 },
  barBg:      { height: 6, backgroundColor: SURFACE, borderRadius: 3, overflow: 'hidden' },
  barFill:    { height: 6, borderRadius: 3 },
  statusText: { fontSize: 13, fontWeight: '600' },
  statsRow:   { flexDirection: 'row', alignItems: 'center', paddingTop: 4 },
  stat:       { flex: 1, alignItems: 'center', gap: 2 },
  statDivider:{ width: 1, height: 28, backgroundColor: BORDER },
  statValue:  { fontSize: 18, fontWeight: '800', color: TEXT },
  statLabel:  { fontSize: 11, color: TEXT_MUTED },
});

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <Text style={sh.title}>{title}</Text>
  );
}

const sh = StyleSheet.create({
  title: { fontSize: 11, fontWeight: '700', color: TEXT_MUTED, letterSpacing: 1.2, textTransform: 'uppercase' },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function CalendarScreen() {
  const { dayPlan } = useDayPlanContext();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useFocusEffect(useCallback(() => { Analytics.screenViewed('planning'); }, []));

  useEffect(() => {
    loadProfile().then(p => { if (p) setProfile(p); });
  }, []);

  // Guard — profile not yet loaded: show setup prompt
  if (!profile) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
          <MascotImage emotion="rassurante" size="md" />
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#ffffff', textAlign: 'center' }}>
            Your plan is being built
          </Text>
          <Text style={{ fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 22 }}>
            {"Complete your sleep profile so R-Lo can calculate your anchor time, bedtime windows, and weekly target."}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const activeProfile: UserProfile = profile;

  const recentCycles  = dayPlan?.readiness?.recentCycles ?? [5, 4, 5];
  const target        = activeProfile.idealCyclesPerNight;
  const wearableNote  = dayPlan?.rloMessage?.text ?? null;

  // Wearable-adjusted cycles: if readiness zone is orange, recommend +1
  const zone            = dayPlan?.readiness?.zone ?? null;
  const adjustedCycles  = zone === 'orange' ? Math.min(target + 1, 6) : target;
  const wearableActive  = !!dayPlan?.readiness;

  // Week
  const week       = buildWeek(activeProfile);
  const todayIdx   = week.findIndex(d => d.isToday);

  // Insights
  const insights = buildInsights(activeProfile, recentCycles, wearableNote);

  // R90 Score
  const totalAchieved = recentCycles.reduce((a, b) => a + b, 0);
  const r90Score      = calcR90Score(recentCycles, target);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <Text style={s.title}>Planning</Text>
          <Text style={s.date}>{todayLabel()}</Text>
        </View>

        {/* ── Tonight ── */}
        <TonightCard
          profile={activeProfile}
          adjustedCycles={adjustedCycles}
          wearableActive={wearableActive}
        />

        {/* ── This Week ── */}
        <View style={s.section}>
          <SectionHeader title="This Week" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.weekScroll}
          >
            {week.map((day, i) => (
              <WeekDayCard key={day.dayShort} day={day} isSelected={i === todayIdx} />
            ))}
          </ScrollView>

          {/* R90 note */}
          <View style={s.r90Note}>
            <Ionicons name="information-circle-outline" size={13} color={TEXT_MUTED} />
            <Text style={s.r90NoteText}>
              R90 varies cycles across the week. Recovery nights (4 cycles) are planned — not failures.
            </Text>
          </View>
        </View>

        {/* ── Insights ── */}
        {insights.length > 0 && (
          <View style={s.section}>
            <SectionHeader title="R-Lo Insights" />
            <View style={s.insightsWrap}>
              {/* Insight 0 — actionable, mis en évidence */}
              <InsightPrimary text={insights[0]!} />
              {/* Insights 1+ — éducatifs, discrets */}
              {insights.slice(1).length > 0 && (
                <View style={s.insightsSecondary}>
                  {insights.slice(1).map((txt, i) => (
                    <InsightSecondary key={i} text={txt} index={i + 1} />
                  ))}
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── R90 Score ── */}
        {recentCycles.length > 0 ? (
          <R90ScoreCard
            score={r90Score}
            cycles={totalAchieved}
            target={target}
            nights={recentCycles.length}
          />
        ) : (
          <View style={s.section}>
            <SectionHeader title="R90 Score" />
            <View style={s.scoreEmpty}>
              <Ionicons name="stats-chart-outline" size={28} color={TEXT_MUTED} />
              <Text style={s.scoreEmptyText}>Track a few nights to see your R90 score</Text>
            </View>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: BG },
  scroll:         { flex: 1 },
  content:        { padding: 20, paddingBottom: 120, gap: 24 },
  header:         { gap: 4 },
  title:          { fontSize: 28, fontWeight: '800', color: TEXT, letterSpacing: -0.5 },
  date:           { fontSize: 13, color: TEXT_MUTED },
  section:        { gap: 12 },
  weekScroll:     { gap: 8, paddingRight: 4 },
  r90Note:        { flexDirection: 'row', gap: 6, alignItems: 'flex-start', marginTop: 4 },
  r90NoteText:    { flex: 1, fontSize: 11, color: TEXT_MUTED, lineHeight: 16 },
  insightsWrap:      { gap: 10 },
  insightsSecondary: { gap: 8, paddingTop: 4 },
  scoreEmpty:     { backgroundColor: CARD, borderRadius: 20, padding: 24, alignItems: 'center', gap: 10, borderWidth: 1, borderColor: BORDER },
  scoreEmptyText: { fontSize: 13, color: TEXT_MUTED, textAlign: 'center' },
  empty:          { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText:      { fontSize: 14, color: TEXT_MUTED, textAlign: 'center' },
});
