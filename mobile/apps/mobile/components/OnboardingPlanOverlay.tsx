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
import { Ionicons } from '@expo/vector-icons';
import { updateProfile } from '../lib/api';
import { signIn, signUp } from '../lib/supabase';

// ─── Design tokens ────────────────────────────────────────────────────────────

const BG        = '#0B1220';
const SURFACE   = '#1A2436';
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

function PlanRevealStep({ plan, onContinue }: PlanRevealProps) {
  const cardAnim = useRef(new Animated.Value(0)).current;
  const rloAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(cardAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(rloAnim,  { toValue: 1, duration: 400, delay: 200, useNativeDriver: true }),
    ]).start();
  }, [cardAnim, rloAnim]);

  const cardScale = cardAnim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.0] });

  const rloMessage = `This is your first recovery rhythm.\n\nIf you go to sleep at ${plan.onsetDisplay}, you'll complete ${plan.cycles} full sleep cycles and wake up at ${plan.wakeDisplay} with better recovery.\n\nLet's try this tonight.`;

  return (
    <View style={r.root}>
      {/* Plan card */}
      <Animated.View style={[r.card, { opacity: cardAnim, transform: [{ scale: cardScale }] }]}>
        {/* Label */}
        <Text style={r.cardTitle}>Your sleep rhythm is ready</Text>

        {/* Time display */}
        <View style={r.timeRow}>
          <View style={r.timeBlock}>
            <Text style={r.timeLabel}>Bedtime</Text>
            <Text style={r.timeValue}>{plan.onsetDisplay}</Text>
          </View>
          <View style={r.timeArrow}>
            <Text style={r.arrowText}>→</Text>
          </View>
          <View style={r.timeBlock}>
            <Text style={r.timeLabel}>Wake up</Text>
            <Text style={r.timeValue}>{plan.wakeDisplay}</Text>
          </View>
        </View>

        {/* Cycle dots */}
        <View style={r.cyclesWrap}>
          <Text style={r.cyclesLabel}>{plan.cycles} sleep cycles</Text>
          <CycleDots count={plan.cycles} />
        </View>
      </Animated.View>

      {/* R-Lo message */}
      <Animated.View style={[r.rloRow, { opacity: rloAnim }]}>
        <MascotImage emotion="Fiere" size="sm" />
        <View style={r.rloBubble}>
          <Text style={r.rloText}>{rloMessage}</Text>
        </View>
      </Animated.View>

      {/* CTA */}
      <Animated.View style={[r.ctaWrap, { opacity: rloAnim }]}>
        <Button
          label="Start my rhythm"
          variant="primary"
          size="lg"
          fullWidth
          onPress={onContinue}
        />
      </Animated.View>
    </View>
  );
}

const r = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 24,
  },
  card: {
    backgroundColor:  SURFACE,
    borderRadius:     24,
    borderWidth:      1,
    borderColor:      BORDER,
    padding:          28,
    gap:              20,
    shadowColor:  '#000',
    shadowOpacity: 0.35,
    shadowRadius:  24,
    shadowOffset:  { width: 0, height: 8 },
    elevation:     10,
  },
  cardTitle: {
    fontSize:      18,
    fontFamily:    'Inter-Bold',
    fontWeight:    '700',
    color:         TEXT,
    textAlign:     'center',
    lineHeight:    26,
  },
  timeRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            8,
  },
  timeBlock: { alignItems: 'center', gap: 4 },
  timeArrow: { paddingHorizontal: 8, paddingTop: 10 },
  arrowText: { fontSize: 22, color: TEXT_MUTED, fontWeight: '300' },
  timeLabel: {
    fontSize:      11,
    fontFamily:    'Inter-Regular',
    color:         TEXT_MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  timeValue: {
    fontSize:      38,
    fontFamily:    'Inter-Bold',
    fontWeight:    '700',
    color:         ACCENT,
    letterSpacing: -1,
  },
  cyclesWrap: { alignItems: 'center', gap: 8 },
  cyclesLabel: {
    fontSize:   13,
    fontFamily: 'Inter-SemiBold',
    fontWeight: '600',
    color:      TEXT_MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  rloRow: {
    flexDirection: 'row',
    alignItems:    'flex-end',
    gap:           12,
  },
  rloBubble: {
    flex:                1,
    backgroundColor:     SURFACE,
    borderRadius:        16,
    borderTopLeftRadius: 4,
    borderWidth:         1,
    borderColor:         BORDER,
    paddingHorizontal:   16,
    paddingVertical:     14,
  },
  rloText: {
    fontSize:   15,
    fontFamily: 'Inter-Regular',
    color:      TEXT,
    lineHeight: 24,
  },
  ctaWrap: {},
});

// ─── Step 12 — Calendar connection ───────────────────────────────────────────



function PermissionStep({
  plan,
  onComplete,
}: {
  plan:       PlanData;
  onComplete: () => void;
}) {
  const [permStep, setPermStep] = useState<'calendar' | 'notifications' | 'saving'>('calendar');
  const [calGranted, setCalGranted] = useState(false);

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

  async function handleCalendar() {
    await requestCalendar();
    setCalGranted(true);
    setPermStep('notifications');
  }

  async function handleNotifications() {
    await requestNotifications();
    setPermStep('saving');
  }

  const isCalendar = permStep === 'calendar';
  const icon       = isCalendar ? 'calendar-outline' : 'notifications-outline';
  const title      = isCalendar ? 'Sync your calendar' : 'Stay on track';
  const body       = isCalendar
    ? 'R-Lo uses your calendar to protect your sleep window and avoid conflicts.'
    : 'Get a nudge before your wind-down and when your sleep window opens.';
  const primaryLabel   = isCalendar ? 'Allow Calendar Access' : 'Allow Notifications';
  const secondaryLabel = isCalendar ? 'Skip' : 'Skip';
  const handlePrimary  = isCalendar ? handleCalendar : handleNotifications;
  const handleSecondary = () => {
    if (isCalendar) setPermStep('notifications');
    else setPermStep('saving');
  };

  return (
    <SafeAreaView style={perm.safe} edges={['top', 'bottom']}>
      <View style={perm.card}>
        <View style={perm.iconWrap}>
          <Ionicons name={icon as any} size={36} color={ACCENT} />
        </View>
        <Text style={perm.title}>{title}</Text>
        <Text style={perm.body}>{body}</Text>

        <View style={perm.dots}>
          <View style={[perm.dot, !isCalendar && perm.dotDone]} />
          <View style={[perm.dot, isCalendar && perm.dotInactive, !isCalendar && perm.dotActive]} />
        </View>

        <View style={perm.actions}>
          <Pressable style={perm.btnPrimary} onPress={handlePrimary}>
            <Text style={perm.btnPrimaryText}>{primaryLabel}</Text>
          </Pressable>
          <Pressable style={perm.btnSecondary} onPress={handleSecondary}>
            <Text style={perm.btnSecondaryText}>{secondaryLabel}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const perm = StyleSheet.create({
  safe:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card:       { width: '88%', backgroundColor: SURFACE, borderRadius: 24, padding: 28, alignItems: 'center', gap: 14, borderWidth: 1, borderColor: BORDER },
  iconWrap:   { width: 72, height: 72, borderRadius: 22, backgroundColor: `${ACCENT}18`, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${ACCENT}30` },
  title:      { fontSize: 20, fontWeight: '700', color: TEXT, textAlign: 'center' },
  body:       { fontSize: 15, color: TEXT_SUB, textAlign: 'center', lineHeight: 22 },
  dots:       { flexDirection: 'row', gap: 6, marginTop: 4 },
  dot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: ACCENT },
  dotInactive:{ backgroundColor: BORDER },
  dotDone:    { backgroundColor: `${ACCENT}55` },
  dotActive:  { backgroundColor: ACCENT },
  actions:    { width: '100%', gap: 10, marginTop: 4 },
  btnPrimary:     { backgroundColor: ACCENT, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  btnPrimaryText: { fontSize: 16, fontWeight: '600', color: '#0B1220' },
  btnSecondary:     { backgroundColor: 'transparent', borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  btnSecondaryText: { fontSize: 15, fontWeight: '500', color: TEXT_MUTED },
});


// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  onComplete:      () => void;
  onCalendarDone?: () => void; // unused, kept for compat
  calendarOnly?:   boolean;    // skip to step 12 directly
}

export function OnboardingPlanOverlay({ onComplete, calendarOnly = false }: Props) {
  const [step, setStep]       = useState<PlanStep>(calendarOnly ? 12 : 10);
  const [plan, setPlan]       = useState<PlanData>({ onsetDisplay: '23:00', wakeDisplay: '06:30', cycles: 5 });
  const contentAnim           = useRef(new Animated.Value(1)).current;

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

    // Auto-advance to step 11 after 6 s — let the user feel the plan is being built
    const t = setTimeout(() => {
      Animated.timing(contentAnim, { toValue: 0, duration: 280, useNativeDriver: true })
        .start(() => {
          setStep(11);
          Animated.timing(contentAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
        });
    }, 6000);
    return () => clearTimeout(t);
  }, [contentAnim]);

  // ── Step 11 → login (plan reveal done, navigate to login) ────────────────
  const handleContinueToCalendar = useCallback(() => {
    if (!calendarOnly) {
      // Phase 'plan': after reveal → login (caller handles navigation)
      onComplete();
    }
  }, [calendarOnly, onComplete]);

  // ── Background: fully opaque for 10–11, translucent for 12 ───────────────
  const bgColor = step === 12 ? 'rgba(0,0,0,0.45)' : BG;

  return (
    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: bgColor }]}>
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: contentAnim }]}>
        {step === 10 && (
          <SafeAreaView style={ov.safe} edges={['top', 'bottom']}>
            <GeneratingStep />
          </SafeAreaView>
        )}

        {step === 11 && (
          <SafeAreaView style={ov.safe} edges={['top', 'bottom']}>
            <PlanRevealStep plan={plan} onContinue={handleContinueToCalendar} />
          </SafeAreaView>
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
