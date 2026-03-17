/**
 * OnboardingPlanOverlay — steps 10–12.
 *
 *   10 – Plan generation  (animated ring, 1.2 s, then auto-advance)
 *   11 – Plan reveal      (premium card: sleep onset / wake / cycles)
 *   12 – Calendar connect (R-Lo chat + permission request)
 *
 * Renders above the Home screen as an absoluteFill overlay in the tabs layout.
 * Calls onComplete() after step 12 so the layout can unmount it and return
 * the user to the normal Home experience.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MascotImage } from './ui/MascotImage';
import { Button } from './ui/Button';
import { TypingDots } from './ui/TypingDots';
import { formatTime } from '@r90/core';
import {
  loadChatOnboardingData,
  loadProfile,
  saveProfile,
  markPlanOnboardingComplete,
} from '../lib/storage';
import { requestCalendar, requestNotifications } from '../lib/permissions';
import { getCurrentOffering, purchasePackage } from '../lib/purchases';
import type { PurchasesPackage } from 'react-native-purchases';
import { connectGoogleCalendar } from '../lib/google-calendar';
import { initAppleHealth } from '../lib/apple-health';
import { connectOura } from '../lib/oura';
import { Ionicons } from '@expo/vector-icons';
import { updateProfile } from '../lib/api';
import { signIn, signUp } from '../lib/supabase';
import { Analytics } from '../lib/analytics';

// ─── Design tokens ────────────────────────────────────────────────────────────

const BG        = '#0B1220';
const SURFACE   = '#1A2436';
const SURFACE_2 = '#243046';
const BORDER    = '#243046';
const TEXT      = '#E6EDF7';
const TEXT_SUB  = '#9FB0C5';
const TEXT_MUTED= '#6B7F99';
const ACCENT    = '#33C8E8';
const USER_TEXT = '#0B1220';

// ─── Time helpers ─────────────────────────────────────────────────────────────

/** Parse a "HH:MM" string into minutes from midnight. Returns fallback on failure. */
function parseHHMM(str: string, fallback: number): number {
  if (!str || !str.includes(':')) return fallback;
  const [h, m] = str.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return fallback;
  return h * 60 + m;
}



// ─── Types ────────────────────────────────────────────────────────────────────

type PlanStep  = 10 | 11 | 12;

interface PlanData {
  onsetDisplay: string;  // e.g. "23:00"
  wakeDisplay:  string;  // e.g. "06:30"
  cycles:       number;  // e.g. 5
}

// ─── Step 10 — Plan generation ────────────────────────────────────────────────

const RING_SIZE = 220;
const DOT_SIZE  = 12;

function GeneratingStep() {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const glowAnim   = useRef(new Animated.Value(0)).current;
  const textAnim   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const rot = Animated.loop(
      Animated.timing(rotateAnim, { toValue: 1, duration: 5000, useNativeDriver: true }),
    );
    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.2, duration: 1400, useNativeDriver: true }),
      ]),
    );
    Animated.timing(textAnim, { toValue: 1, duration: 600, delay: 200, useNativeDriver: true }).start();
    rot.start();
    glow.start();
    return () => { rot.stop(); glow.stop(); };
  }, [rotateAnim, glowAnim, textAnim]);

  const rotateDeg = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.05, 0.18] });
  const glowScale   = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.12] });
  const ringOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.90] });

  return (
    <View style={g.root}>
      {/* Ring + orbiting dot */}
      <View style={g.ringWrap}>
        {/* Outer glow */}
        <Animated.View
          style={[
            g.glowOuter,
            { opacity: glowOpacity, transform: [{ scale: glowScale }] },
          ]}
        />
        {/* Main ring */}
        <Animated.View style={[g.ring, { opacity: ringOpacity }]}>
          {/* Inner concentric rings */}
          <View style={g.innerRing1} />
          <View style={g.innerRing2} />
        </Animated.View>
        {/* Orbiting dot */}
        <Animated.View
          style={[g.orbitContainer, { transform: [{ rotate: rotateDeg }] }]}
          pointerEvents="none"
        >
          <View style={g.orbitDot} />
        </Animated.View>
      </View>

      {/* Text */}
      <Animated.View style={[g.textWrap, { opacity: textAnim }]}>
        <Text style={g.title}>{"Building your\nrecovery plan"}</Text>
        <Text style={g.body}>
          {"Based on your rhythm,\nyour anchor time,\nand your current schedule."}
        </Text>
      </Animated.View>
    </View>
  );
}

const g = StyleSheet.create({
  root: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 48,
    paddingHorizontal: 32,
  },
  ringWrap: {
    width: RING_SIZE, height: RING_SIZE,
    alignItems: 'center', justifyContent: 'center',
  },
  glowOuter: {
    position: 'absolute',
    width: RING_SIZE * 1.4, height: RING_SIZE * 1.4,
    borderRadius: (RING_SIZE * 1.4) / 2,
    backgroundColor: ACCENT,
  },
  ring: {
    position: 'absolute',
    width: RING_SIZE, height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 2,
    borderColor: ACCENT,
    alignItems: 'center', justifyContent: 'center',
    // iOS glow
    shadowColor: ACCENT, shadowOpacity: 0.6, shadowRadius: 16, shadowOffset: { width: 0, height: 0 },
  },
  innerRing1: {
    position: 'absolute',
    width: RING_SIZE * 0.73, height: RING_SIZE * 0.73,
    borderRadius: (RING_SIZE * 0.73) / 2,
    borderWidth: 1, borderColor: `${ACCENT}55`,
  },
  innerRing2: {
    position: 'absolute',
    width: RING_SIZE * 0.48, height: RING_SIZE * 0.48,
    borderRadius: (RING_SIZE * 0.48) / 2,
    borderWidth: 1, borderColor: `${ACCENT}28`,
  },
  orbitContainer: {
    position: 'absolute',
    width: RING_SIZE, height: RING_SIZE,
    alignItems: 'center',
  },
  orbitDot: {
    width: DOT_SIZE, height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: ACCENT,
    marginTop: -(DOT_SIZE / 2),
    shadowColor: ACCENT, shadowOpacity: 1, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
  },
  textWrap: { alignItems: 'center', gap: 16 },
  title: {
    fontSize: 26, fontFamily: 'Inter-Bold', fontWeight: '700',
    color: TEXT, textAlign: 'center', lineHeight: 36, letterSpacing: -0.3,
  },
  body: {
    fontSize: 16, fontFamily: 'Inter-Regular', fontWeight: '400',
    color: TEXT_SUB, textAlign: 'center', lineHeight: 26,
  },
});

// ─── Step 11 — Plan reveal ────────────────────────────────────────────────────

interface PlanRevealProps {
  plan:       PlanData;
  onContinue: () => void;
}

function CycleDots({ count }: { count: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 6 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            width: 10, height: 10, borderRadius: 5,
            backgroundColor: ACCENT,
            opacity: 0.85 - i * 0.04,
          }}
        />
      ))}
    </View>
  );
}

// ─── Paywall ──────────────────────────────────────────────────────────────────

const FEATURES = [
  { icon: 'moon-outline',         text: 'Personalised sleep cycles & bedtime' },
  { icon: 'chatbubble-outline',   text: 'Unlimited R-Lo AI coaching' },
  { icon: 'pulse-outline',        text: 'HRV & wearable data integration' },
  { icon: 'calendar-outline',     text: 'Calendar-aware sleep planning' },
  { icon: 'stats-chart-outline',  text: 'Weekly recovery reports' },
  { icon: 'notifications-outline',text: 'Smart wind-down reminders' },
];

function PaywallStep({ plan, onComplete }: { plan: PlanData; onComplete: () => void }) {
  const [packages,   setPackages]   = useState<PurchasesPackage[]>([]);
  const [selected,   setSelected]   = useState<'monthly' | 'yearly'>('yearly');
  const [loading,    setLoading]    = useState(false);
  const [loadingRC,  setLoadingRC]  = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Analytics.paywallViewed('onboarding');
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    getCurrentOffering().then(res => {
      if (res.ok && res.offering?.availablePackages) {
        setPackages(res.offering.availablePackages);
      }
      setLoadingRC(false);
    });
  }, []);

  const monthlyPkg = packages.find(p =>
    p.packageType === 'MONTHLY' || p.identifier.includes('monthly')
  );
  const yearlyPkg = packages.find(p =>
    p.packageType === 'ANNUAL' || p.identifier.includes('yearly') || p.identifier.includes('annual')
  );

  const selectedPkg = selected === 'yearly' ? yearlyPkg : monthlyPkg;

  async function handleSubscribe() {
    if (!selectedPkg) { onComplete(); return; }
    Analytics.purchaseStarted(selected);
    setLoading(true);
    const result = await purchasePackage(selectedPkg);
    setLoading(false);
    if (result.ok) Analytics.purchaseCompleted(selected);
    if (result.error === 'cancelled') Analytics.purchaseCancelled();
    if (result.ok || result.error === 'cancelled') onComplete();
  }

  // Fallback prices shown while RC loads or if offering unavailable
  const monthlyPrice  = monthlyPkg?.product.priceString  ?? '$9.99';
  const yearlyPrice   = yearlyPkg?.product.priceString   ?? '$79.99';
  const yearlyMonthly = yearlyPkg
    ? `${yearlyPkg.product.currencyCode} ${(yearlyPkg.product.price / 12).toFixed(2)}/mo`
    : '$6.67/mo';

  return (
    <SafeAreaView style={pw.safe} edges={['top', 'bottom']}>
      <Animated.ScrollView
        style={{ opacity: fadeAnim }}
        contentContainerStyle={pw.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={pw.header}>
          <View style={pw.badge}>
            <Text style={pw.badgeText}>Your plan is ready</Text>
          </View>
          <Text style={pw.title}>Unlock R-Lo{'\n'}Sleep Coaching</Text>
          <Text style={pw.sub}>
            Based on your profile, R-Lo will guide you to{' '}
            <Text style={pw.subBold}>{plan.cycles} cycles</Text> per night, waking at{' '}
            <Text style={pw.subBold}>{plan.wakeDisplay}</Text>.
          </Text>
        </View>

        {/* Features */}
        <View style={pw.features}>
          {FEATURES.map(f => (
            <View key={f.text} style={pw.featureRow}>
              <View style={pw.featureIcon}>
                <Ionicons name={f.icon as any} size={16} color={ACCENT} />
              </View>
              <Text style={pw.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        {/* Plan selector */}
        {/* Plan selector — always visible (prices fallback to hardcoded while RC loads) */}
        {(
          <View style={pw.plans}>
            <Pressable
              style={[pw.plan, selected === 'yearly' && pw.planSelected]}
              onPress={() => setSelected('yearly')}
            >
              <View style={pw.planBadgeWrap}>
                <View style={pw.saveBadge}><Text style={pw.saveBadgeText}>Best value</Text></View>
              </View>
              <Text style={pw.planLabel}>Yearly</Text>
              <Text style={pw.planPrice}>{yearlyPrice}</Text>
              {yearlyMonthly && <Text style={pw.planSub}>{yearlyMonthly}</Text>}
            </Pressable>

            <Pressable
              style={[pw.plan, selected === 'monthly' && pw.planSelected]}
              onPress={() => setSelected('monthly')}
            >
              <View style={pw.planBadgeWrap} />
              <Text style={pw.planLabel}>Monthly</Text>
              <Text style={pw.planPrice}>{monthlyPrice}</Text>
              <Text style={pw.planSub}>per month</Text>
            </Pressable>
          </View>
        )}

        {/* CTA */}
        <Pressable
          style={[pw.cta, loading && { opacity: 0.7 }]}
          onPress={handleSubscribe}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#000" />
            : <Text style={pw.ctaText}>Start 7-day free trial</Text>
          }
        </Pressable>
        <Text style={pw.ctaSub}>Cancel anytime · No charge during trial</Text>

        {/* Skip */}
        <Pressable style={pw.skip} onPress={onComplete}>
          <Text style={pw.skipText}>Continue without trial</Text>
        </Pressable>

        <Text style={pw.legal}>
          Subscription auto-renews unless cancelled at least 24 hours before the end of the current period.
        </Text>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const pw = StyleSheet.create({
  safe:       { flex: 1 },
  scroll:     { padding: 24, paddingBottom: 40, gap: 20 },
  header:     { alignItems: 'center', gap: 10 },
  badge:      { backgroundColor: `${ACCENT}22`, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, borderWidth: 1, borderColor: `${ACCENT}40` },
  badgeText:  { fontSize: 12, fontWeight: '600', color: ACCENT },
  title:      { fontSize: 30, fontWeight: '800', color: TEXT, textAlign: 'center', lineHeight: 36 },
  sub:        { fontSize: 15, color: TEXT_SUB, textAlign: 'center', lineHeight: 22 },
  subBold:    { fontWeight: '700', color: TEXT },
  features:   { gap: 10 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureIcon:{ width: 32, height: 32, borderRadius: 10, backgroundColor: `${ACCENT}18`, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${ACCENT}30` },
  featureText:{ fontSize: 14, color: TEXT, flex: 1 },
  plans:      { flexDirection: 'row', gap: 10 },
  plan:       { flex: 1, backgroundColor: SURFACE, borderRadius: 16, padding: 14, alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: BORDER },
  planSelected:{ borderColor: ACCENT, backgroundColor: `${ACCENT}0D` },
  planBadgeWrap:{ height: 20, justifyContent: 'center' },
  saveBadge:  { backgroundColor: ACCENT, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  saveBadgeText:{ fontSize: 10, fontWeight: '700', color: '#0B1220' },
  planLabel:  { fontSize: 15, fontWeight: '700', color: TEXT },
  planPrice:  { fontSize: 18, fontWeight: '800', color: TEXT },
  planSub:    { fontSize: 11, color: TEXT_MUTED, textAlign: 'center' },
  cta:        { backgroundColor: ACCENT, borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  ctaText:    { fontSize: 17, fontWeight: '700', color: '#0B1220' },
  ctaSub:     { fontSize: 12, color: TEXT_MUTED, textAlign: 'center' },
  skip:       { alignItems: 'center', paddingVertical: 4 },
  skipText:   { fontSize: 14, color: TEXT_MUTED },
  legal:      { fontSize: 11, color: TEXT_MUTED, textAlign: 'center', lineHeight: 16 },
});

// ─── Plan reveal ──────────────────────────────────────────────────────────────

// ─── Plan reveal helpers ──────────────────────────────────────────────────────

function cyclesToDuration(cycles: number): string {
  const h = Math.floor((cycles * 90) / 60);
  const m = (cycles * 90) % 60;
  return m === 0 ? `${h}h` : `${h}h${m}`;
}

interface CycleOption {
  cycles:   number;
  bedtime:  string;
  label:    string;
  tag:      string;
  tagColor: string;
  isMain:   boolean;
}

function buildCycleOptions(wakeMin: number, targetCycles: number): CycleOption[] {
  const options = [
    { cycles: 6, tag: 'Optimal recovery', tagColor: '#A78BFA', isMain: false },
    { cycles: 5, tag: 'Recommended',       tagColor: ACCENT,    isMain: true  },
    { cycles: 4, tag: 'Alternative',        tagColor: '#FACC15', isMain: false },
  ].map(o => ({
    ...o,
    label:   `${cyclesToDuration(o.cycles)} · ${o.cycles} cycles`,
    bedtime: formatTime(((wakeMin - o.cycles * 90) + 1440) % 1440),
  }));
  return options;
}

// ─── Teaser block ─────────────────────────────────────────────────────────────

function TeaserBlock({ icon, title, subtitle }: {
  icon:     string;
  title:    string;
  subtitle: string;
}) {
  return (
    <View style={tb.wrap}>
      <View style={tb.lockRow}>
        <View style={tb.iconWrap}>
          <Ionicons name={icon as any} size={16} color={TEXT_MUTED} />
        </View>
        <View style={tb.textWrap}>
          <Text style={tb.title}>{title}</Text>
          <Text style={tb.sub}>{subtitle}</Text>
        </View>
        <View style={tb.lockBadge}>
          <Ionicons name="lock-closed" size={11} color={TEXT_MUTED} />
        </View>
      </View>
      {/* Blurred placeholder rows */}
      <View style={tb.mockRows}>
        {[0.7, 0.45, 0.3].map((op, i) => (
          <View key={i} style={[tb.mockRow, { opacity: op, width: `${85 - i * 15}%` as any }]} />
        ))}
      </View>
    </View>
  );
}

const tb = StyleSheet.create({
  wrap:     { backgroundColor: SURFACE, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: BORDER, gap: 12, opacity: 0.65 },
  lockRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  textWrap: { flex: 1 },
  title:    { fontSize: 14, fontWeight: '700', color: TEXT_SUB },
  sub:      { fontSize: 12, color: TEXT_MUTED, marginTop: 1 },
  lockBadge:{ width: 24, height: 24, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  mockRows: { gap: 6 },
  mockRow:  { height: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4 },
});

// ─── PlanRevealStep ───────────────────────────────────────────────────────────

function PlanRevealStep({ plan, onContinue }: PlanRevealProps) {
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const weekAnim   = useRef(new Animated.Value(0)).current;
  const teaserAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(fadeAnim,   { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(weekAnim,   { toValue: 1, duration: 400, delay: 100, useNativeDriver: true }),
      Animated.timing(teaserAnim, { toValue: 1, duration: 350, delay: 100, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, weekAnim, teaserAnim]);

  const wakeMin      = parseHHMM(plan.wakeDisplay, 390);
  const cycleOptions = buildCycleOptions(wakeMin, plan.cycles);

  // Build 7-day week (same bedtime every day — R90 principle: consistent wake time)
  const today     = new Date();
  const mainOption = cycleOptions.find(o => o.isMain)!;
  const weekDays  = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - today.getDay() + 1 + i);
    return {
      dayShort: d.toLocaleDateString('en-US', { weekday: 'short' }),
      isToday:  d.toDateString() === today.toDateString(),
    };
  });

  return (
    <View style={{ flex: 1 }}>
      <Animated.ScrollView
        style={{ opacity: fadeAnim }}
        contentContainerStyle={r.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header badge ── */}
        <View style={r.badgeRow}>
          <View style={r.badge}>
            <Text style={r.badgeText}>Your plan is ready</Text>
          </View>
        </View>

        {/* ── Tonight — 3 cycle options ── */}
        <View style={r.section}>
          <Text style={r.sectionTitle}>TONIGHT</Text>
          {cycleOptions.map(opt => (
            <View key={opt.cycles} style={[r.cycleRow, opt.isMain && r.cycleRowMain]}>
              {/* Bedtime hero */}
              <View style={r.cycleLeft}>
                <Text style={[r.cycleTime, opt.isMain && { color: ACCENT }]}>{opt.bedtime}</Text>
                <Text style={r.cycleLabel}>{opt.label}</Text>
              </View>

              {/* Dots */}
              <View style={r.cycleDots}>
                {Array.from({ length: opt.cycles }).map((_, i) => (
                  <View
                    key={i}
                    style={[r.cycleDot, { backgroundColor: opt.tagColor, opacity: opt.isMain ? 1 : 0.5 }]}
                  />
                ))}
              </View>

              {/* Tag */}
              <View style={[r.cycleTag, { borderColor: `${opt.tagColor}50` }]}>
                <Text style={[r.cycleTagText, { color: opt.tagColor }]}>{opt.tag}</Text>
              </View>
            </View>
          ))}

          {/* Wake time row */}
          <View style={r.wakeRow}>
            <Ionicons name="sunny-outline" size={14} color="#4ADE80" />
            <Text style={r.wakeText}>Wake up every day at <Text style={r.wakeBold}>{plan.wakeDisplay}</Text></Text>
            <View style={r.wakeConsistencyBadge}>
              <Text style={r.wakeConsistencyText}>R90</Text>
            </View>
          </View>
        </View>

        {/* ── This Week ── */}
        <Animated.View style={[r.section, { opacity: weekAnim }]}>
          <Text style={r.sectionTitle}>THIS WEEK</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={r.weekScroll}>
            {weekDays.map((day) => (
              <View key={day.dayShort} style={[r.weekDay, day.isToday && r.weekDayToday]}>
                <Text style={[r.weekDayLabel, day.isToday && r.weekDayLabelToday]}>{day.dayShort}</Text>
                <View style={r.weekDots}>
                  {Array.from({ length: plan.cycles }).map((_, i) => (
                    <View key={i} style={[r.weekDot, day.isToday && { backgroundColor: ACCENT }]} />
                  ))}
                </View>
                <Text style={[r.weekBedtime, day.isToday && { color: ACCENT }]}>{mainOption.bedtime}</Text>
                <Text style={r.weekWake}>{plan.wakeDisplay}</Text>
              </View>
            ))}
          </ScrollView>
          <Text style={r.weekNote}>
            Consistent wake time is the foundation of the R90 method. Your body clock aligns to it within 7 days.
          </Text>
        </Animated.View>

        {/* ── R-Lo message ── */}
        <View style={r.rloRow}>
          <MascotImage emotion="Fiere" size="sm" />
          <View style={r.rloBubble}>
            <Text style={r.rloText}>
              {"This is your starter plan — built from your wake time alone.\n\nOnce I'm connected to your calendar and wearables, I'll fine-tune it every day automatically."}
            </Text>
          </View>
        </View>

        {/* ── CTA ── */}
        <View style={r.ctaWrap}>
          <Button
            label="Unlock full coaching"
            variant="primary"
            size="lg"
            fullWidth
            onPress={onContinue}
          />
          <Text style={r.ctaNote}>7-day free trial · Cancel anytime</Text>
        </View>

      </Animated.ScrollView>
    </View>
  );
}

const r = StyleSheet.create({
  scroll:              { padding: 24, paddingBottom: 60, gap: 24 },
  badgeRow:            { alignItems: 'center' },
  badge:               { backgroundColor: `${ACCENT}22`, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, borderWidth: 1, borderColor: `${ACCENT}40` },
  badgeText:           { fontSize: 12, fontWeight: '600', color: ACCENT },
  section:             { gap: 10 },
  sectionTitle:        { fontSize: 11, fontWeight: '700', color: TEXT_MUTED, letterSpacing: 1.2 },
  // Cycle options
  cycleRow:            { backgroundColor: SURFACE, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: BORDER },
  cycleRowMain:        { backgroundColor: `${ACCENT}0D`, borderColor: `${ACCENT}40` },
  cycleLeft:           { flex: 1, gap: 2 },
  cycleTime:           { fontSize: 22, fontWeight: '800', color: TEXT, letterSpacing: -0.5 },
  cycleLabel:          { fontSize: 11, color: TEXT_MUTED },
  cycleDots:           { flexDirection: 'row', gap: 3 },
  cycleDot:            { width: 7, height: 7, borderRadius: 4 },
  cycleTag:            { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  cycleTagText:        { fontSize: 10, fontWeight: '700' },
  // Wake row
  wakeRow:             { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  wakeText:            { flex: 1, fontSize: 13, color: TEXT_MUTED },
  wakeBold:            { fontWeight: '700', color: '#4ADE80' },
  wakeConsistencyBadge:{ backgroundColor: 'rgba(74,222,128,0.15)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  wakeConsistencyText: { fontSize: 9, fontWeight: '800', color: '#4ADE80', letterSpacing: 0.5 },
  // Week
  weekScroll:          { gap: 8, paddingRight: 4 },
  weekDay:             { width: 68, backgroundColor: SURFACE, borderRadius: 14, padding: 10, alignItems: 'center', gap: 5, borderWidth: 1, borderColor: BORDER },
  weekDayToday:        { borderColor: `${ACCENT}60`, backgroundColor: `${ACCENT}0D` },
  weekDayLabel:        { fontSize: 11, fontWeight: '700', color: TEXT_MUTED },
  weekDayLabelToday:   { color: ACCENT },
  weekDots:            { flexDirection: 'row', gap: 2 },
  weekDot:             { width: 5, height: 5, borderRadius: 3, backgroundColor: SURFACE_2 },
  weekBedtime:         { fontSize: 12, fontWeight: '700', color: TEXT_SUB },
  weekWake:            { fontSize: 10, color: TEXT_MUTED },
  weekNote:            { fontSize: 11, color: TEXT_MUTED, lineHeight: 16 },
  // R-Lo message
  rloRow:              { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  rloBubble:           { flex: 1, backgroundColor: SURFACE, borderRadius: 16, borderTopLeftRadius: 4, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 16, paddingVertical: 14 },
  rloText:             { fontSize: 14, color: TEXT, lineHeight: 22 },
  // CTA
  ctaWrap:             { gap: 10 },
  ctaNote:             { fontSize: 12, color: TEXT_MUTED, textAlign: 'center' },
});

// ─── Step 12 — Calendar connection ───────────────────────────────────────────



function PermissionStep({
  plan,
  onComplete,
}: {
  plan:       PlanData;
  onComplete: () => void;
}) {
  const [permStep, setPermStep] = useState<'calendar' | 'wearables' | 'notifications' | 'saving'>('calendar');
  const [googleLoading, setGoogleLoading] = useState(false);

  // Save profile and complete after permissions
  useEffect(() => {
    if (permStep !== 'saving') return;
    const t = setTimeout(async () => {
      try {
        const anchorMin = parseHHMM(plan.wakeDisplay, 390);
        const h   = Math.floor(anchorMin / 60);
        const m   = anchorMin % 60;
        const rMM = m >= 15 ? '30' : '00';
        const arpTime = `${String(h).padStart(2, '0')}:${rMM}`;
        await Promise.all([
          saveProfile({
            anchorTime:          anchorMin,
            chronotype:          'Neither',
            idealCyclesPerNight: plan.cycles,
            weeklyTarget:        plan.cycles * 7,
          }),
          updateProfile({
            arp_time:             arpTime,
            arp_committed:        true,
            cycle_target:         plan.cycles,
            onboarding_completed: true,
            onboarding_step:      12,
          }),
        ]);
      } catch { /* non-blocking */ }
      markPlanOnboardingComplete().catch(() => {});
      onComplete();
    }, 400);
    return () => clearTimeout(t);
  }, [permStep, plan, onComplete]);

  async function handleNativeCalendar() {
    await requestCalendar();
    setPermStep('wearables');
  }

  async function handleGoogleCalendar() {
    setGoogleLoading(true);
    try { await connectGoogleCalendar(); } catch { /* non-critical */ }
    setGoogleLoading(false);
    setPermStep('wearables');
  }

  async function handleNotifications() {
    await requestNotifications();
    setPermStep('saving');
  }

  async function handleAppleHealthOnboard() {
    try { await initAppleHealth(); } catch { /* non-critical */ }
    setPermStep('notifications');
  }

  const [ouraLoading, setOuraLoading] = useState(false);
  async function handleOuraOnboard() {
    setOuraLoading(true);
    try { await connectOura(); } catch { /* non-critical */ }
    setOuraLoading(false);
    setPermStep('saving');
  }

  // ── Step 1: Calendar ────────────────────────────────────────────────────────
  if (permStep === 'calendar') {
    return (
      <View style={bs.overlay}>
        <View style={bs.sheet}>
          <View style={bs.handle} />
          <View style={bs.iconRow}>
            <View style={bs.iconWrap}>
              <Ionicons name="calendar-outline" size={28} color={ACCENT} />
            </View>
          </View>
          <Text style={bs.title}>Let R-Lo see your day</Text>
          <Text style={bs.body}>R-Lo can read your upcoming schedule to protect your sleep window.</Text>
          <View style={bs.dots}>
            <View style={bs.dotActive} /><View style={bs.dotInactive} /><View style={bs.dotInactive} />
          </View>
          <View style={bs.actions}>
            <Pressable style={bs.btnApple} onPress={handleNativeCalendar}>
              <Ionicons name="calendar" size={18} color="#0B1220" />
              <Text style={bs.btnAppleText}>Allow Calendar Access</Text>
            </Pressable>
            <Pressable style={bs.btnGoogle} onPress={handleGoogleCalendar} disabled={googleLoading}>
              <Ionicons name="logo-google" size={16} color={ACCENT} />
              <Text style={bs.btnGoogleText}>{googleLoading ? 'Connecting…' : 'Connect Google Calendar'}</Text>
            </Pressable>
            <Pressable style={bs.btnSkip} onPress={() => setPermStep('wearables')}>
              <Text style={bs.btnSkipText}>Skip for now</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // ── Step 2: Wearables ────────────────────────────────────────────────────────
  if (permStep === 'wearables') {
    return (
      <View style={bs.overlay}>
        <View style={bs.sheet}>
          <View style={bs.handle} />
          <View style={bs.iconRow}>
            <View style={bs.iconWrap}>
              <Ionicons name="watch-outline" size={28} color={ACCENT} />
            </View>
          </View>
          <Text style={bs.title}>Connect your health data</Text>
          <Text style={bs.body}>R-Lo uses your sleep and recovery data to give you personalised coaching.</Text>
          <View style={bs.dots}>
            <View style={bs.dotDone} /><View style={bs.dotActive} /><View style={bs.dotInactive} />
          </View>
          <View style={bs.actions}>
            <Pressable style={bs.btnApple} onPress={handleAppleHealthOnboard}>
              <Ionicons name="heart" size={18} color="#0B1220" />
              <Text style={bs.btnAppleText}>Connect Apple Health</Text>
            </Pressable>
            <Pressable style={[bs.btnGoogle, ouraLoading && { opacity: 0.6 }]} onPress={handleOuraOnboard} disabled={ouraLoading}>
              <Ionicons name="radio-outline" size={16} color={ACCENT} />
              <Text style={bs.btnGoogleText}>{ouraLoading ? 'Connecting…' : 'Connect Oura Ring'}</Text>
            </Pressable>
            <Pressable style={bs.btnSkip} onPress={() => setPermStep('notifications')}>
              <Text style={bs.btnSkipText}>Skip for now</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // ── Step 3: Notifications (final) ────────────────────────────────────────────
  return (
    <View style={bs.overlay}>
      <View style={bs.sheet}>
        <View style={bs.handle} />
        <View style={bs.iconRow}>
          <View style={bs.iconWrap}>
            <Ionicons name="notifications-outline" size={28} color={ACCENT} />
          </View>
        </View>
        <Text style={bs.title}>Stay on track</Text>
        <Text style={bs.body}>Get a gentle nudge before your wind-down and when it's time to sleep.</Text>
        <View style={bs.dots}>
          <View style={bs.dotDone} /><View style={bs.dotDone} /><View style={bs.dotActive} />
        </View>
        <View style={bs.actions}>
          <Pressable style={bs.btnApple} onPress={handleNotifications}>
            <Ionicons name="notifications" size={18} color="#0B1220" />
            <Text style={bs.btnAppleText}>Allow Notifications</Text>
          </Pressable>
          <Pressable style={bs.btnSkip} onPress={() => setPermStep('saving')}>
            <Text style={bs.btnSkipText}>Skip for now</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const bs = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor:   SURFACE,
    borderTopLeftRadius:  28,
    borderTopRightRadius: 28,
    paddingTop:  12,
    paddingHorizontal: 24,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    gap: 12,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginBottom: 8,
  },
  iconRow: { alignItems: 'center', marginBottom: 4 },
  iconWrap: {
    width: 60, height: 60, borderRadius: 18,
    backgroundColor: `${ACCENT}18`,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: `${ACCENT}30`,
  },
  title: { fontSize: 20, fontWeight: '700', color: TEXT, textAlign: 'center' },
  body:  { fontSize: 14, color: TEXT_SUB, textAlign: 'center', lineHeight: 21 },
  actions: { gap: 10, marginTop: 4 },
  btnApple: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: ACCENT, borderRadius: 14,
    paddingVertical: 15,
  },
  btnAppleText: { fontSize: 16, fontWeight: '600', color: '#0B1220' },
  btnGoogle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'transparent', borderRadius: 14,
    paddingVertical: 14, borderWidth: 1, borderColor: ACCENT,
  },
  btnGoogleText: { fontSize: 15, fontWeight: '500', color: ACCENT },
  btnSkip: { alignItems: 'center', paddingVertical: 10 },
  btnSkipText: { fontSize: 14, color: TEXT_MUTED },
  dots:        { flexDirection: 'row', gap: 6, justifyContent: 'center', marginTop: 4 },
  dotActive:   { width: 8, height: 8, borderRadius: 4, backgroundColor: ACCENT },
  dotInactive: { width: 8, height: 8, borderRadius: 4, backgroundColor: BORDER },
  dotDone:     { width: 8, height: 8, borderRadius: 4, backgroundColor: `${ACCENT}55` },
});


// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  onComplete:      () => void;
  onCalendarDone?: () => void; // unused, kept for compat
  calendarOnly?:   boolean;    // skip to step 12 directly
}

export function OnboardingPlanOverlay({ onComplete, calendarOnly = false }: Props) {
  const [step, setStep]         = useState<PlanStep>(calendarOnly ? 12 : 10);
  const [showPaywall, setShowPaywall] = useState(false);
  const [plan, setPlan]         = useState<PlanData>({ onsetDisplay: '23:00', wakeDisplay: '06:30', cycles: 5 });
  const contentAnim             = useRef(new Animated.Value(1)).current;

  // ── Load plan data and auto-advance step 10 ───────────────────────────────
  useEffect(() => {
    async function loadPlan() {
      const [chatData, profile] = await Promise.all([
        loadChatOnboardingData(),
        loadProfile(),
      ]);

      // Wake time: prefer step-7 answer, fall back to pager ARP
      const fallbackWake = profile?.anchorTime ?? 390; // 06:30
      const wakeMin = parseHHMM(chatData?.wakeTime ?? '', fallbackWake);
      const cycles  = profile?.idealCyclesPerNight ?? 5;
      const onsetMin = wakeMin - cycles * 90;

      setPlan({
        wakeDisplay:  formatTime(wakeMin),
        onsetDisplay: formatTime(onsetMin),
        cycles,
      });
    }

    loadPlan();

    // Auto-advance to step 11 only during the plan generation flow (not calendarOnly)
    if (calendarOnly) return;
    const t = setTimeout(() => {
      Animated.timing(contentAnim, { toValue: 0, duration: 280, useNativeDriver: true })
        .start(() => {
          setStep(11);
          Animated.timing(contentAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
        });
    }, 6000);
    return () => clearTimeout(t);
  }, [contentAnim]);

  // ── Step 11 → paywall → login ────────────────────────────────────────────
  const handlePlanContinue = useCallback(() => {
    if (!calendarOnly) setShowPaywall(true);
  }, [calendarOnly]);

  const handlePaywallDone = useCallback(() => {
    setShowPaywall(false);
    onComplete(); // → login
  }, [onComplete]);

  // ── Background ────────────────────────────────────────────────────────────
  const bgColor = step === 12 ? 'transparent' : BG;

  return (
    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: bgColor }]}>
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: contentAnim }]}>
        {step === 10 && (
          <SafeAreaView style={ov.safe} edges={['top', 'bottom']}>
            <GeneratingStep />
          </SafeAreaView>
        )}

        {step === 11 && !showPaywall && (
          <SafeAreaView style={ov.safe} edges={['top', 'bottom']}>
            <PlanRevealStep plan={plan} onContinue={handlePlanContinue} />
          </SafeAreaView>
        )}

        {step === 11 && showPaywall && (
          <PaywallStep plan={plan} onComplete={handlePaywallDone} />
        )}

        {step === 12 && (
          <PermissionStep plan={plan} onComplete={onComplete} />
        )}
      </Animated.View>
    </View>
  );
}

const ov = StyleSheet.create({
  safe: { flex: 1 },
});
