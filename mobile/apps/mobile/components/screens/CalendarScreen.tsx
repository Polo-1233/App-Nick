/**
 * Planning tab — "Tonight's Plan"
 *
 * Vertical timeline: Wind-down → Ideal bedtime → Latest bedtime → Wake up → Morning routine
 * Grounded in R90 methodology. No calendar grid.
 */

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useDayPlanContext } from '../../lib/day-plan-context';
import { loadProfile } from '../../lib/storage';
import type { UserProfile } from '@r90/types';

// ─── Design tokens ────────────────────────────────────────────────────────────

const BG      = '#0B1220';
const CARD    = '#1A2436';
const SURFACE = '#243046';
const ACCENT  = '#4DA3FF';
const TEXT    = '#F0F4FF';
const TEXT_SUB= '#8899BB';
const TEXT_MUTED = '#5A6A88';
const BORDER  = 'rgba(255,255,255,0.06)';
const GREEN   = '#4ADE80';
const YELLOW  = '#FACC15';
const ORANGE  = '#F97171';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function minToHHMM(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function getCurrentMinute(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function isNowBetween(startMin: number, endMin: number): boolean {
  const now = getCurrentMinute();
  // Handle overnight spans (e.g. 22:30 → 07:30)
  if (startMin <= endMin) return now >= startMin && now < endMin;
  return now >= startMin || now < endMin;
}

function todayLabel(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

// ─── Timeline event types ─────────────────────────────────────────────────────

type EventKind = 'winddown' | 'bedtime' | 'latest' | 'wake' | 'morning';

interface TimelineEvent {
  kind:     EventKind;
  time:     number; // minutes
  label:    string;
  sublabel: string;
  icon:     string;
  color:    string;
  bgColor:  string;
}

function buildTimeline(profile: UserProfile): TimelineEvent[] {
  const wake    = profile.anchorTime;          // e.g. 450 = 07:30
  const cycles  = profile.idealCyclesPerNight; // e.g. 5
  const bedtime = ((wake - cycles * 90) + 1440) % 1440; // sleep onset
  const windDown = ((bedtime - 90) + 1440) % 1440;      // pre-sleep start
  const latest   = (bedtime + 180) % 1440;               // 2 cycles late max
  const morning  = (wake + 30) % 1440;                   // 30 min morning routine

  return [
    {
      kind:     'winddown',
      time:     windDown,
      label:    'Wind-down',
      sublabel: 'Screens off, dim the lights',
      icon:     'moon-outline',
      color:    '#A78BFA',
      bgColor:  '#A78BFA18',
    },
    {
      kind:     'bedtime',
      time:     bedtime,
      label:    'Ideal bedtime',
      sublabel: `${cycles} cycles · ${minToHHMM(wake)} wake`,
      icon:     'bed-outline',
      color:    ACCENT,
      bgColor:  `${ACCENT}18`,
    },
    {
      kind:     'latest',
      time:     latest,
      label:    'Latest bedtime',
      sublabel: 'After this, drop to 4 cycles',
      icon:     'alert-circle-outline',
      color:    YELLOW,
      bgColor:  `${YELLOW}18`,
    },
    {
      kind:     'wake',
      time:     wake,
      label:    'Wake up',
      sublabel: 'Rise — your ARP anchor',
      icon:     'sunny-outline',
      color:    GREEN,
      bgColor:  `${GREEN}18`,
    },
    {
      kind:     'morning',
      time:     morning,
      label:    'Morning routine',
      sublabel: '30 min — no rush, no screens',
      icon:     'cafe-outline',
      color:    '#FCA5A5',
      bgColor:  '#FCA5A518',
    },
  ];
}

// ─── Readiness section ────────────────────────────────────────────────────────

function ReadinessBadge({ zone }: { zone: 'green' | 'yellow' | 'orange' | null }) {
  if (!zone) return null;
  const map = {
    green:  { label: 'Well recovered',   color: GREEN,  bg: `${GREEN}18`  },
    yellow: { label: 'Moderate recovery', color: YELLOW, bg: `${YELLOW}18` },
    orange: { label: 'Needs recovery',    color: ORANGE, bg: `${ORANGE}18` },
  };
  const { label, color, bg } = map[zone];
  return (
    <View style={[rb.badge, { backgroundColor: bg, borderColor: `${color}40` }]}>
      <View style={[rb.dot, { backgroundColor: color }]} />
      <Text style={[rb.text, { color }]}>{label}</Text>
    </View>
  );
}

const rb = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, alignSelf: 'flex-start' },
  dot:   { width: 6, height: 6, borderRadius: 3 },
  text:  { fontSize: 12, fontWeight: '600' },
});

// ─── Cycle count summary ──────────────────────────────────────────────────────

function CycleBar({ cycles, target }: { cycles: number; target: number }) {
  const filled = Math.min(cycles, target);
  return (
    <View style={cb.row}>
      {Array.from({ length: target }).map((_, i) => (
        <View
          key={i}
          style={[cb.pill, i < filled && cb.pillFilled]}
        />
      ))}
    </View>
  );
}

const cb = StyleSheet.create({
  row:        { flexDirection: 'row', gap: 4 },
  pill:       { flex: 1, height: 6, borderRadius: 3, backgroundColor: SURFACE },
  pillFilled: { backgroundColor: ACCENT },
});

// ─── Timeline event row ───────────────────────────────────────────────────────

function EventRow({
  event,
  isLast,
  isNow,
}: {
  event:  TimelineEvent;
  isLast: boolean;
  isNow:  boolean;
}) {
  return (
    <View style={er.wrap}>
      {/* Left column: dot + line */}
      <View style={er.track}>
        <View style={[er.dot, { backgroundColor: event.color, shadowColor: event.color }]}>
          <Ionicons name={event.icon as any} size={14} color={event.color === YELLOW || event.color === '#FCA5A5' ? '#0B1220' : '#0B1220'} />
        </View>
        {!isLast && <View style={er.line} />}
      </View>

      {/* Right column: content card */}
      <View style={[er.card, isNow && { borderColor: `${event.color}60`, backgroundColor: event.bgColor }]}>
        {isNow && (
          <View style={[er.nowBadge, { backgroundColor: event.color }]}>
            <Text style={er.nowText}>NOW</Text>
          </View>
        )}
        <View style={er.cardInner}>
          <View style={er.timeWrap}>
            <Text style={[er.time, { color: event.color }]}>{minToHHMM(event.time)}</Text>
          </View>
          <View style={er.info}>
            <Text style={er.label}>{event.label}</Text>
            <Text style={er.sub}>{event.sublabel}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const er = StyleSheet.create({
  wrap:      { flexDirection: 'row', gap: 14, marginBottom: 0 },
  track:     { alignItems: 'center', width: 36 },
  dot:       { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 8, elevation: 4 },
  line:      { flex: 1, width: 2, backgroundColor: BORDER, marginVertical: 4, minHeight: 20 },
  card:      { flex: 1, backgroundColor: CARD, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: BORDER },
  nowBadge:  { position: 'absolute', top: 10, right: 10, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  nowText:   { fontSize: 10, fontWeight: '800', color: '#0B1220' },
  cardInner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  timeWrap:  { minWidth: 44 },
  time:      { fontSize: 17, fontWeight: '800', letterSpacing: -0.5 },
  info:      { flex: 1 },
  label:     { fontSize: 15, fontWeight: '700', color: TEXT },
  sub:       { fontSize: 12, color: TEXT_SUB, marginTop: 2 },
});

// ─── R-Lo insight card ────────────────────────────────────────────────────────

function InsightCard({ message }: { message: string }) {
  return (
    <View style={ic.wrap}>
      <View style={ic.avatar}>
        <Text style={ic.avatarText}>R</Text>
      </View>
      <View style={ic.bubble}>
        <Text style={ic.text}>{message}</Text>
      </View>
    </View>
  );
}

const ic = StyleSheet.create({
  wrap:       { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  avatar:     { width: 32, height: 32, borderRadius: 16, backgroundColor: `${ACCENT}25`, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${ACCENT}40`, marginTop: 2 },
  avatarText: { fontSize: 14, fontWeight: '800', color: ACCENT },
  bubble:     { flex: 1, backgroundColor: CARD, borderRadius: 14, borderTopLeftRadius: 4, padding: 14, borderWidth: 1, borderColor: BORDER },
  text:       { fontSize: 13, color: TEXT_SUB, lineHeight: 19 },
});

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return <Text style={sh.title}>{title}</Text>;
}

const sh = StyleSheet.create({
  title: { fontSize: 11, fontWeight: '700', color: TEXT_MUTED, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12, marginTop: 4 },
});

// ─── Sleep summary row (last 3 nights) ────────────────────────────────────────

function NightDot({ cycles, target }: { cycles: number; target: number }) {
  const ratio = cycles / target;
  const color = ratio >= 0.9 ? GREEN : ratio >= 0.6 ? YELLOW : ORANGE;
  return (
    <View style={nd.col}>
      <View style={[nd.bar, { backgroundColor: color, height: Math.max(8, Math.round(ratio * 40)) }]} />
      <Text style={nd.label}>{cycles}c</Text>
    </View>
  );
}

const nd = StyleSheet.create({
  col:   { alignItems: 'center', gap: 4 },
  bar:   { width: 24, borderRadius: 4, minHeight: 8 },
  label: { fontSize: 11, color: TEXT_MUTED },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function CalendarScreen() {
  const { dayPlan } = useDayPlanContext();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    loadProfile().then(p => { if (p) setProfile(p); });
  }, []);

  // Timeline data
  const timeline = profile ? buildTimeline(profile) : null;
  const now      = getCurrentMinute();

  // Detect current event (which window we're in right now)
  const nowEventIdx = timeline
    ? (() => {
        for (let i = 0; i < timeline.length - 1; i++) {
          const curr = timeline[i]!;
          const next = timeline[i + 1]!;
          if (isNowBetween(curr.time, next.time)) return i;
        }
        return -1;
      })()
    : -1;

  // Readiness from dayPlan
  const zone       = dayPlan?.readiness?.zone ?? null;
  const recentCycles = dayPlan?.readiness?.recentCycles ?? [];
  const target     = profile?.idealCyclesPerNight ?? 5;

  // R-Lo message
  const rloMsg = dayPlan?.rloMessage?.text
    ?? (profile
      ? `Your target is ${profile.idealCyclesPerNight} sleep cycles tonight. Wind-down starts ${minToHHMM(((profile.anchorTime - profile.idealCyclesPerNight * 90 - 90) + 1440) % 1440)} — protect that window.`
      : 'Load your profile to see your personalised sleep plan.');

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <View style={s.headerTop}>
            <View>
              <Text style={s.title}>Tonight's Plan</Text>
              <Text style={s.date}>{todayLabel()}</Text>
            </View>
            <ReadinessBadge zone={zone as any} />
          </View>
        </View>

        {/* ── R-Lo message ── */}
        <InsightCard message={rloMsg} />

        {/* ── Timeline ── */}
        {timeline ? (
          <View style={s.section}>
            <SectionHeader title="Sleep timeline" />
            <View style={s.timeline}>
              {timeline.map((ev, i) => (
                <EventRow
                  key={ev.kind}
                  event={ev}
                  isLast={i === timeline.length - 1}
                  isNow={i === nowEventIdx}
                />
              ))}
            </View>
          </View>
        ) : (
          <View style={s.placeholder}>
            <Ionicons name="moon-outline" size={32} color={TEXT_MUTED} />
            <Text style={s.placeholderText}>Complete your profile to see your plan</Text>
          </View>
        )}

        {/* ── Last 3 nights ── */}
        {recentCycles.length > 0 && (
          <View style={s.section}>
            <SectionHeader title="Recent nights" />
            <View style={s.nightsCard}>
              <View style={s.nightsBars}>
                {[...recentCycles].reverse().map((c, i) => (
                  <NightDot key={i} cycles={c} target={target} />
                ))}
              </View>
              <View style={s.nightsRight}>
                <Text style={s.weeklyText}>
                  {recentCycles.reduce((a, b) => a + b, 0)} cycles
                </Text>
                <Text style={s.weeklySub}>last {recentCycles.length} nights</Text>
                {profile && (
                  <View style={{ marginTop: 8, width: '100%' }}>
                    <CycleBar
                      cycles={recentCycles.reduce((a, b) => a + b, 0)}
                      target={target * recentCycles.length}
                    />
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {/* ── R90 reminder ── */}
        <View style={s.section}>
          <View style={s.tipCard}>
            <Ionicons name="information-circle-outline" size={16} color={TEXT_MUTED} />
            <Text style={s.tipText}>
              R90 targets 5 cycles (7h30) as the optimal nightly minimum. Consistency of wake time matters more than total sleep.
            </Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: BG },
  scroll:        { flex: 1 },
  content:       { padding: 20, paddingBottom: 100, gap: 20 },
  header:        { gap: 10 },
  headerTop:     { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  title:         { fontSize: 28, fontWeight: '800', color: TEXT },
  date:          { fontSize: 13, color: TEXT_MUTED, marginTop: 2 },
  section:       { gap: 0 },
  timeline:      { gap: 0 },
  placeholder:   { alignItems: 'center', gap: 12, paddingVertical: 40 },
  placeholderText:{ fontSize: 14, color: TEXT_MUTED, textAlign: 'center' },
  nightsCard:    { backgroundColor: CARD, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', borderWidth: 1, borderColor: BORDER },
  nightsBars:    { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  nightsRight:   { alignItems: 'flex-end', flex: 1, paddingLeft: 16 },
  weeklyText:    { fontSize: 22, fontWeight: '800', color: TEXT },
  weeklySub:     { fontSize: 12, color: TEXT_MUTED },
  tipCard:       { flexDirection: 'row', gap: 10, backgroundColor: CARD, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: BORDER, alignItems: 'flex-start' },
  tipText:       { fontSize: 12, color: TEXT_MUTED, flex: 1, lineHeight: 18 },
});
