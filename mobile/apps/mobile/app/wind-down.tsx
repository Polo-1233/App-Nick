/**
 * wind-down.tsx — Flow guidé de préparation au sommeil
 *
 * 4 phases séquentielles :
 *   1. intro       — 3s, R-Lo introduit le wind-down
 *   2. checklist   — items à cocher (adaptatifs après 14j / 21j)
 *   3. content     — sélection + lecture audio
 *   4. mood_check  — humeur du soir
 *   5. goodnight   — écran presque noir, fenêtre de sommeil
 *
 * Note: La demande de notification a été déplacée hors du wind-down.
 * Elle s'affiche sur le HomeScreen après le PREMIER wind-down complété.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated,
  ScrollView, Platform, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { MascotImage }   from '../components/ui/MascotImage';
import { AudioPlayer }   from '../components/AudioPlayer';
import { usePremiumGate } from '../lib/use-premium-gate';
import { getNextContent, markContentPlayed } from '../lib/content-registry';
import { addPoints, POINTS } from '../lib/rhythm-points';
import { addSignal, SIGNAL } from '../lib/rhythm-depth';
import { HapticsLight, HapticsSuccess } from '../utils/haptics';
import { saveChecklistRecord } from '../lib/kspi';
import { syncTeamChallengeProgress } from '../lib/team-challenges';
import { incrementWindDownCount } from '../lib/badges';
import { useBadgeEvaluation } from '../lib/use-badge-evaluation';
import { BadgeEarnedModal } from '../components/BadgeEarnedModal';
import { trackWinddown } from '../lib/activity-tracker';
import { requestNotifications } from '../lib/permissions';
import {
  shouldShowNotifPrompt,
  dismissNotifPrompt,
  markNotifGranted,
} from '../lib/contextual-permissions';
import { RLoTooltip } from '../components/RLoGuide';
import { SessionIntro } from '../components/SessionIntro';
import { GUIDE_KEYS, shouldShowGuide, markGuideSeen } from '../lib/onboarding-guide';
import type { ContentItem } from '../lib/content-registry';

// Wind-down is always dark — immersive, sleep-oriented
const BG     = '#0a0a3a';   // darkTheme.background
const CARD   = '#141466';   // darkTheme.surface
const ACCENT = '#1c9fda';   // darkTheme.accent
const TEXT   = '#FFFFFF';    // darkTheme.text
const MUTED  = '#6B8CAE';   // darkTheme.textMuted

type WindDownPhase = 'intro' | 'checklist' | 'content' | 'mood_check' | 'goodnight';

// ─── Checklist history (adaptive checklist) ───────────────────────────────────
const CHECKLIST_HISTORY_KEY = '@r90:checklistHistory:v1';
const WINDDOWN_COUNT_KEY    = '@r90:winddownCount';
const CUSTOM_ITEMS_KEY      = '@r90:checklistCustomItems:v1';

interface ChecklistItemHistory {
  timesShown:   number;
  timesChecked: number;
  firstSeenDate: string; // YYYY-MM-DD
}
interface ChecklistHistory {
  [itemId: string]: ChecklistItemHistory;
}

async function loadChecklistHistory(): Promise<ChecklistHistory> {
  try {
    const raw = await AsyncStorage.getItem(CHECKLIST_HISTORY_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

async function saveChecklistHistory(h: ChecklistHistory): Promise<void> {
  await AsyncStorage.setItem(CHECKLIST_HISTORY_KEY, JSON.stringify(h)).catch(() => {});
}

/** Returns true if this item has been checked > 90% of the time over at least 14 sessions */
function isHabitFormed(h: ChecklistItemHistory | undefined): boolean {
  if (!h) return false;
  if (h.timesShown < 14) return false;
  return h.timesChecked / h.timesShown > 0.9;
}

async function loadCustomItems(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(CUSTOM_ITEMS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function saveCustomItems(items: string[]): Promise<void> {
  await AsyncStorage.setItem(CUSTOM_ITEMS_KEY, JSON.stringify(items)).catch(() => {});
}

async function getDaysSinceInstall(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem('@r90:signupDate:v1');
    if (!raw) return 0;
    return Math.floor((Date.now() - new Date(raw).getTime()) / 86_400_000);
  } catch { return 0; }
}

const CHECKLIST = [
  { id: 'lights',   label: 'Lights dimmed?' },
  { id: 'cool',     label: 'Room is cool?' },
  { id: 'caffeine', label: 'No more caffeine?' },
  { id: 'screens',  label: 'Screens on night mode?' },
  { id: 'ready',    label: 'Ready to sleep?' },
];

// ─── Phase 1 — Intro ──────────────────────────────────────────────────────────
function IntroPhase({ onNext, showTip, onDismissTip }: {
  onNext: () => void;
  showTip?: boolean;
  onDismissTip?: () => void;
}) {
  useEffect(() => {
    // Delay auto-advance if tip is showing (give user time to read)
    const delay = showTip ? 6000 : 3000;
    const t = setTimeout(onNext, delay);
    return () => clearTimeout(t);
  }, [onNext, showTip]);

  return (
    <Pressable style={ph.wrap} onPress={onNext}>
      <MascotImage emotion="rassurante" size="md" />
      <Text style={ph.title}>Your wind-down starts now.</Text>
      <Text style={ph.sub}>Prepare for a good night.</Text>
      {showTip && onDismissTip && (
        <View style={{ position: 'absolute', bottom: 100, left: 0, right: 0 }}>
          <RLoTooltip
            visible
            message="This prepares your body for sleep. A calm transition from your day."
            onDismiss={onDismissTip}
          />
        </View>
      )}
    </Pressable>
  );
}

// ─── Phase 2 — Checklist (adaptive) ─────────────────────────────────────────
function ChecklistPhase({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const [checked,      setChecked]      = useState<Record<string, boolean>>({});
  const [history,      setHistory]      = useState<ChecklistHistory>({});
  const [customItems,  setCustomItems]  = useState<string[]>([]);
  const [customInput,  setCustomInput]  = useState('');
  const [showAddInput, setShowAddInput] = useState(false);
  const [canAddOwn,    setCanAddOwn]    = useState(false);

  // All renderable items: base + custom (habits pre-checked, moved to bottom)
  const baseItems = CHECKLIST.map(item => ({
    id:       item.id,
    label:    item.label,
    isCustom: false,
    isHabit:  isHabitFormed(history[item.id]),
  }));
  const customRenderable = customItems.map(label => ({
    id:       `custom_${label}`,
    label,
    isCustom: true,
    isHabit:  false,
  }));
  const normalItems = [...baseItems, ...customRenderable].filter(i => !i.isHabit);
  const habitItems  = [...baseItems].filter(i => i.isHabit);
  const allRenderItems = [...normalItems, ...habitItems];

  const allScales = useRef<Animated.Value[]>([]);
  if (allScales.current.length !== allRenderItems.length) {
    allScales.current = allRenderItems.map(() => new Animated.Value(1));
  }

  useEffect(() => {
    loadChecklistHistory().then(h => {
      setHistory(h);
      // Pre-check habit items
      const preChecked: Record<string, boolean> = {};
      CHECKLIST.forEach(item => { if (isHabitFormed(h[item.id])) preChecked[item.id] = true; });
      setChecked(preChecked);
    });
    loadCustomItems().then(setCustomItems);
    getDaysSinceInstall().then(days => setCanAddOwn(days >= 21));
  }, []);

  function toggle(id: string, idx: number) {
    HapticsLight();
    const scale = allScales.current[idx];
    if (scale) {
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.15, useNativeDriver: true, speed: 50 }),
        Animated.spring(scale, { toValue: 1.00, useNativeDriver: true, speed: 50 }),
      ]).start();
    }
    setChecked(prev => ({ ...prev, [id]: !prev[id] }));
  }

  const nonHabitItems = allRenderItems.filter(i => !i.isHabit);
  const allNonHabitChecked = nonHabitItems.length > 0
    && nonHabitItems.every(i => checked[i.id]);
  const checkedCount = Object.values(checked).filter(Boolean).length;

  async function persistAndNext() {
    // Update checklist history
    const today = new Date().toISOString().slice(0, 10);
    const updatedHistory = { ...history };
    CHECKLIST.forEach(item => {
      const prev = updatedHistory[item.id] ?? { timesShown: 0, timesChecked: 0, firstSeenDate: today };
      updatedHistory[item.id] = {
        ...prev,
        timesShown:   prev.timesShown + 1,
        timesChecked: prev.timesChecked + (checked[item.id] ? 1 : 0),
      };
    });
    await saveChecklistHistory(updatedHistory);
    saveChecklistRecord(checkedCount, allRenderItems.length).catch(() => {});
    onNext();
  }

  useEffect(() => {
    if (allNonHabitChecked && nonHabitItems.length > 0) {
      HapticsSuccess();
      const t = setTimeout(() => { void persistAndNext(); }, 600);
      return () => clearTimeout(t);
    }
  }, [allNonHabitChecked]);

  async function handleAddCustom() {
    const label = customInput.trim();
    if (!label || label.length > 40) return;
    const updated = [...customItems, label];
    setCustomItems(updated);
    await saveCustomItems(updated);
    setCustomInput('');
    setShowAddInput(false);
    HapticsLight();
  }

  return (
    <View style={ph.wrap}>
      <Text style={ph.title}>Set up your space</Text>
      <View style={cl.list}>
        {allRenderItems.map((item, i) => (
          <Pressable key={item.id} onPress={() => toggle(item.id, i)}>
            <Animated.View
              style={[
                cl.row,
                checked[item.id] && cl.rowDone,
                item.isHabit && cl.rowHabit,
                { transform: [{ scale: allScales.current[i] ?? new Animated.Value(1) }] },
              ]}
            >
              <View style={[cl.check, checked[item.id] && { backgroundColor: item.isHabit ? '#22c55e' : ACCENT }]}>
                {checked[item.id] && <Ionicons name="checkmark" size={16} color="#fff" />}
              </View>
              <Text style={[cl.label, checked[item.id] && cl.labelDone, item.isHabit && cl.labelHabit]}>
                {item.label}
              </Text>
              {item.isHabit && (
                <View style={cl.habitBadge}>
                  <Text style={cl.habitBadgeText}>Habit ✓</Text>
                </View>
              )}
            </Animated.View>
          </Pressable>
        ))}

        {/* Add your own — after 21 days */}
        {canAddOwn && !showAddInput && (
          <Pressable style={cl.addOwnBtn} onPress={() => setShowAddInput(true)}>
            <Ionicons name="add-circle-outline" size={18} color={MUTED} />
            <Text style={cl.addOwnText}>Add a personal item...</Text>
          </Pressable>
        )}
        {canAddOwn && showAddInput && (
          <View style={cl.addOwnInputRow}>
            <TextInput
              style={cl.addOwnInput}
              value={customInput}
              onChangeText={t => setCustomInput(t.slice(0, 40))}
              placeholder="My item..."
              placeholderTextColor={MUTED}
              maxLength={40}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => { void handleAddCustom(); }}
            />
            <Pressable style={cl.addOwnConfirm} onPress={() => { void handleAddCustom(); }}>
              <Ionicons name="checkmark" size={18} color="#fff" />
            </Pressable>
          </View>
        )}
      </View>
      <Pressable onPress={() => { void persistAndNext(); }} style={ph.mainBtn}>
        <Text style={ph.mainBtnTxt}>Continue →</Text>
      </Pressable>
      <Pressable
        onPress={() => { saveChecklistRecord(checkedCount, allRenderItems.length).catch(() => {}); onSkip(); }}
        style={ph.skipBtn}
      >
        <Text style={ph.skipTxt}>Skip</Text>
      </Pressable>
    </View>
  );
}

// ─── Phase 3 — Content ────────────────────────────────────────────────────────
function ContentPhase({
  onComplete, isPremium, onClose,
}: { onComplete: () => void; isPremium: boolean; onClose: () => void }) {
  const [content,  setContent]  = useState<ContentItem | null>(null);
  const [playing,  setPlaying]  = useState(false);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    getNextContent('winddown', isPremium).then(c => { setContent(c); setLoading(false); });
  }, [isPremium]);

  async function handleComplete() {
    if (!content) return;
    await markContentPlayed('winddown', content.id);
    await addPoints(POINTS.WINDDOWN_CONTENT, 'winddown_content').catch(() => {});
    await addSignal(SIGNAL.WINDDOWN_COMPLETE).catch(() => {});
    void syncTeamChallengeProgress('winddown_completions');
    onComplete();
  }

  if (loading || !content) return null;

  if (playing) {
    return (
      <AudioPlayer
        source={content.source}
        title={content.title}
        duration={`${Math.round(content.duration / 60)} min`}
        variant="winddown"
        onComplete={() => { void handleComplete(); }}
        onClose={() => setPlaying(false)}
      />
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }} edges={['top', 'bottom']}>
    <View style={ph.wrap}>
      <Pressable onPress={onClose} style={s.closeBtn}>
        <Ionicons name="close" size={22} color={MUTED} />
      </Pressable>
      <Text style={ph.title}>Tonight's episode</Text>
      <View style={ct.card}>
        {content.episode && (
          <Text style={ct.cardEpisode}>Episode {content.episode}</Text>
        )}
        <Text style={ct.cardTitle}>{content.title}</Text>
        <Text style={ct.cardSub}>{content.description}</Text>
        <Text style={ct.cardDur}>{Math.round(content.duration / 60)} min</Text>
      </View>
      <Pressable style={ph.mainBtn} onPress={async () => {
        await addPoints(POINTS.WINDDOWN_START, 'winddown_start').catch(() => {});
        await addSignal(SIGNAL.WINDDOWN_START).catch(() => {});
        setPlaying(true);
      }}>
        <Text style={ph.mainBtnTxt}>Listen →</Text>
      </Pressable>
      <Pressable style={ph.skipBtn} onPress={() => {
        getNextContent('winddown', isPremium).then(c => setContent(c));
      }}>
        <Text style={ph.skipTxt}>Something else</Text>
      </Pressable>
    </View>
    </SafeAreaView>
  );
}

// ─── Phase 4 — Notification permission (contextual) ─────────────────────────
function NotifAskPhase({ onNext }: { onNext: () => void }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  async function handleAccept() {
    HapticsSuccess();
    const result = await requestNotifications();
    if (result === 'granted') await markNotifGranted();
    onNext();
  }

  async function handleDismiss() {
    await dismissNotifPrompt();
    onNext();
  }

  return (
    <View style={na.wrap}>
      <Animated.View style={[na.content, { opacity }]}>
        <View style={na.iconWrap}>
          <Ionicons name="notifications-outline" size={32} color={ACCENT} />
        </View>
        <Text style={na.title}>Want R-Lo to remind you{'\n'}tomorrow evening?</Text>
        <Text style={na.sub}>
          A gentle nudge before wind-down{'\n'}and a morning check-in to start your rhythm.
        </Text>
        <Pressable style={na.primaryBtn} onPress={handleAccept}>
          <Text style={na.primaryBtnText}>Yes, remind me</Text>
        </Pressable>
        <Pressable style={na.secondaryBtn} onPress={handleDismiss}>
          <Text style={na.secondaryBtnText}>Not now</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const na = StyleSheet.create({
  wrap: {
    flex: 1, backgroundColor: BG,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32,
  },
  content: { alignItems: 'center', gap: 16, maxWidth: 320 },
  iconWrap: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: 'rgba(28,159,218,0.12)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 22, fontWeight: '700', color: TEXT,
    textAlign: 'center', lineHeight: 30,
  },
  sub: {
    fontSize: 15, color: MUTED, textAlign: 'center',
    lineHeight: 22, marginBottom: 8,
  },
  primaryBtn: {
    backgroundColor: ACCENT, borderRadius: 16,
    paddingVertical: 16, paddingHorizontal: 40,
    width: '100%', alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 16, fontWeight: '700', color: '#fff',
  },
  secondaryBtn: {
    paddingVertical: 12,
  },
  secondaryBtnText: {
    fontSize: 14, fontWeight: '600', color: MUTED,
  },
});

// ─── Phase: Mood check (before goodnight) ─────────────────────────────────────
const EVENING_MOODS = [
  { id: 'calm',     icon: 'leaf-outline'    as const, label: 'Calm' },
  { id: 'neutral',  icon: 'remove-outline'  as const, label: 'Neutral' },
  { id: 'stressed', icon: 'pulse-outline'   as const, label: 'Stressed' },
  { id: 'tired',    icon: 'moon-outline'    as const, label: 'Tired' },
  { id: 'wired',    icon: 'flash-outline'   as const, label: 'Wired' },
];

function MoodCheckPhase({ onNext }: { onNext: () => void }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  function handleSelect(moodId: string) {
    HapticsLight();
    // Store mood for R-Lo personalization
    AsyncStorage.setItem('@r90:eveningMood:latest', JSON.stringify({
      mood: moodId,
      date: new Date().toISOString().slice(0, 10),
    })).catch(() => {});
    // Brief pause then advance
    setTimeout(onNext, 400);
  }

  return (
    <View style={mc.wrap}>
      <Animated.View style={[mc.content, { opacity }]}>
        <Text style={mc.title}>How are you feeling?</Text>
        <Text style={mc.sub}>One tap. No judgement.</Text>
        <View style={mc.moods}>
          {EVENING_MOODS.map(m => (
            <Pressable key={m.id} style={mc.moodBtn} onPress={() => handleSelect(m.id)}>
              <Ionicons name={m.icon} size={22} color={MUTED} />
              <Text style={mc.moodLabel}>{m.label}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={onNext} style={mc.skipBtn}>
          <Text style={mc.skipText}>Skip</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const mc = StyleSheet.create({
  wrap: {
    flex: 1, backgroundColor: BG,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32,
  },
  content: { alignItems: 'center', gap: 20 },
  title: { fontSize: 20, fontWeight: '600', color: TEXT, textAlign: 'center' },
  sub: { fontSize: 14, color: MUTED, textAlign: 'center' },
  moods: {
    flexDirection: 'row', gap: 12, marginTop: 8,
  },
  moodBtn: {
    alignItems: 'center', gap: 6,
    backgroundColor: CARD, borderRadius: 14,
    padding: 14, width: 58,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  moodLabel: { fontSize: 10, color: MUTED, fontWeight: '600' },
  skipBtn: { paddingVertical: 12 },
  skipText: { fontSize: 14, fontWeight: '600', color: MUTED },
});

// ─── Phase: Goodnight ────────────────────────────────────────────────────────
function GoodnightPhase({ onClose }: { onClose: () => void }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 1200, useNativeDriver: true }).start();
  }, []);
  return (
    <Pressable style={gn.wrap} onPress={onClose}>
      <Animated.View style={[gn.content, { opacity }]}>
        <MascotImage emotion="rassurante" size="sm" />
        <Text style={gn.text}>Sleep window open.</Text>
        <Text style={gn.sub}>Good night.</Text>
      </Animated.View>
    </Pressable>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function WindDownScreen() {
  const router        = useRouter();
  const { isPremium } = usePremiumGate();
  const { newBadges, evaluate: evalBadges, clearBadges } = useBadgeEvaluation();
  const [phase, setPhase] = useState<WindDownPhase>('intro');
  const [showWdTip,    setShowWdTip]   = useState(false);
  const [showIntro,    setShowIntro]   = useState(false);

  // Check contextual prompts — show multi-step intro on first visit
  useEffect(() => {
    shouldShowGuide(GUIDE_KEYS.FEAT_WINDDOWN).then(v => {
      if (v) setShowIntro(true);
    }).catch(() => {});
  }, []);

  async function dismissWinddownIntro() {
    await markGuideSeen(GUIDE_KEYS.FEAT_WINDDOWN);
    setShowIntro(false);
  }

  const next = useCallback((p: WindDownPhase) => setPhase(p), []);

  // After content: mood_check → goodnight (notif ask moved to HomeScreen)
  const handleContentComplete = useCallback(() => {
    next('mood_check');
  }, [next]);

  // On goodnight close: increment winddown count + navigate home
  const handleGoodnight = useCallback(async () => {
    try {
      const raw   = await AsyncStorage.getItem(WINDDOWN_COUNT_KEY);
      const count = raw ? parseInt(raw, 10) : 0;
      await AsyncStorage.setItem(WINDDOWN_COUNT_KEY, String(count + 1));
    } catch { /* non-fatal */ }
    await incrementWindDownCount().catch(() => {});
    await trackWinddown().catch(() => {});
    await evalBadges();
    router.replace('/(tabs)');
  }, [router]);

  return (
    <View style={s.root}>
      {phase === 'intro' && (
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <Pressable onPress={() => router.back()} style={s.closeBtn}>
            <Ionicons name="close" size={22} color={MUTED} />
          </Pressable>
          {/* Multi-step intro shown on first visit (before IntroPhase auto-advance) */}
          <SessionIntro
            visible={showIntro}
            sessionType="winddown"
            onStart={dismissWinddownIntro}
            onSkip={dismissWinddownIntro}
          />
          <IntroPhase
            onNext={() => next('checklist')}
            showTip={false}
            onDismissTip={undefined}
          />
        </SafeAreaView>
      )}

      {phase === 'checklist' && (
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <Pressable onPress={() => router.back()} style={s.closeBtn}>
            <Ionicons name="close" size={22} color={MUTED} />
          </Pressable>
          <ChecklistPhase
            onNext={() => next('content')}
            onSkip={() => next('content')}
          />
        </SafeAreaView>
      )}

      {phase === 'content' && (
        <ContentPhase
          isPremium={isPremium}
          onComplete={handleContentComplete}
          onClose={() => router.back()}
        />
      )}

      {phase === 'mood_check' && (
        <MoodCheckPhase onNext={() => next('goodnight')} />
      )}

      {phase === 'goodnight' && (
        <GoodnightPhase onClose={() => { void handleGoodnight(); }} />
      )}

      {/* Badge celebration */}
      {newBadges.length > 0 && (
        <BadgeEarnedModal badgeIds={newBadges} onClose={clearBadges} />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:     { flex: 1, backgroundColor: BG },
  closeBtn: { alignSelf: 'flex-end', padding: 16 },
});

const ph = StyleSheet.create({
  wrap:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 16 },
  title:      { fontSize: 22, fontWeight: '700', color: TEXT, textAlign: 'center', lineHeight: 30 },
  sub:        { fontSize: 15, color: MUTED, textAlign: 'center' },
  mainBtn:    { backgroundColor: ACCENT, borderRadius: 16, paddingHorizontal: 36, paddingVertical: 15, marginTop: 8 },
  mainBtnTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },
  skipBtn:    { paddingVertical: 10 },
  skipTxt:    { fontSize: 13, color: MUTED },
});

const cl = StyleSheet.create({
  list:          { width: '100%', gap: 10, marginVertical: 16 },
  row:           { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: CARD, borderRadius: 14, padding: 16 },
  rowDone:       { backgroundColor: `${ACCENT}15`, borderWidth: 1, borderColor: `${ACCENT}30` },
  rowHabit:      { opacity: 0.65, backgroundColor: 'rgba(34,197,94,0.08)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.2)' },
  check:         { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: MUTED, alignItems: 'center', justifyContent: 'center' },
  label:         { fontSize: 15, color: TEXT, fontWeight: '500', flex: 1 },
  labelDone:     { color: ACCENT },
  labelHabit:    { color: MUTED, fontStyle: 'italic' },
  habitBadge:    { backgroundColor: 'rgba(34,197,94,0.2)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  habitBadgeText:{ fontSize: 10, fontWeight: '700', color: '#22c55e' },
  addOwnBtn:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 4 },
  addOwnText:    { fontSize: 14, color: MUTED, fontStyle: 'italic' },
  addOwnInputRow:{ flexDirection: 'row', alignItems: 'center', gap: 8 },
  addOwnInput:   { flex: 1, backgroundColor: CARD, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: TEXT, borderWidth: 1, borderColor: MUTED },
  addOwnConfirm: { width: 42, height: 42, borderRadius: 12, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' },
});

const ct = StyleSheet.create({
  card:     { backgroundColor: CARD, borderRadius: 18, padding: 20, width: '100%', gap: 8 },
  cardEpisode: { fontSize: 11, fontWeight: '700', color: ACCENT, letterSpacing: 1, textTransform: 'uppercase' as const },
  cardTitle:{ fontSize: 18, fontWeight: '700', color: TEXT },
  cardSub:  { fontSize: 14, color: MUTED, lineHeight: 20 },
  cardDur:  { fontSize: 12, color: ACCENT, fontWeight: '600' },
});

const gn = StyleSheet.create({
  wrap:    { flex: 1, backgroundColor: '#02020e', alignItems: 'center', justifyContent: 'center' },
  content: { alignItems: 'center', gap: 14 },
  text:    { fontSize: 18, fontWeight: '600', color: 'rgba(255,255,255,0.8)', textAlign: 'center' },
  sub:     { fontSize: 14, color: 'rgba(255,255,255,0.4)' },
});
