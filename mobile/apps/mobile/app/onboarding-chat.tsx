/**
 * onboarding-chat.tsx — Guided R-Lo conversation (post-slides, pre-login)
 *
 * Scripted state machine — no AI backend during this flow.
 * Collects: firstName, wakeTimeMinutes, sleepGoal (constraint/priority).
 *
 * Flow:
 *   greeting → q1_name → q2_wake → q3_goal → done
 *   → /login (new) or /(tabs) (already auth'd)
 *
 * After this screen, OnboardingPlanOverlay handles plan creation.
 */

import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView }      from 'react-native-safe-area-context';
import { useRouter }         from 'expo-router';
import { MascotImage }       from '../components/ui/MascotImage';
import {
  saveOnboardingData,
  saveChatOnboardingData,
  hasCompletedIntro,
} from '../lib/storage';
import { useAuth }           from '../lib/auth-context';
import { HapticsLight }      from '../utils/haptics';

// ─── Palette ──────────────────────────────────────────────────────────────────
const BG      = '#0B1220';
const CARD    = '#1A2436';
const SURFACE2= '#243046';
const ACCENT  = '#4DA3FF';
const TEXT    = '#E6EDF7';
const SUB     = '#9FB0C5';
const MUTED   = '#6B7F99';
const BORDER  = 'rgba(255,255,255,0.06)';

// ─── Types ────────────────────────────────────────────────────────────────────
type Step = 'greeting' | 'q1_name' | 'q2_wake' | 'q3_goal' | 'done';

interface LocalMessage {
  id:   string;
  role: 'user' | 'assistant';
  text: string;
}

// ─── Wake time options (in minutes from midnight) ─────────────────────────────
const WAKE_OPTIONS = [
  { label: '05:00', value: 300  },
  { label: '05:30', value: 330  },
  { label: '06:00', value: 360  },
  { label: '06:30', value: 390  },
  { label: '07:00', value: 420  },
  { label: '07:30', value: 450  },
  { label: '08:00', value: 480  },
  { label: '08:30', value: 510  },
  { label: '09:00', value: 540  },
];

// ─── Goal options ─────────────────────────────────────────────────────────────
const GOAL_OPTIONS = [
  { label: 'Better recovery',        value: 'recovery'    },
  { label: 'More energy',            value: 'energy'      },
  { label: 'Fall asleep faster',     value: 'sleep_speed' },
  { label: 'Consistent schedule',    value: 'consistency' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
let _uid = 0;
function uid() { return String(++_uid); }

// ─── Blinking cursor ─────────────────────────────────────────────────────────
function BlinkingCursor() {
  const op = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(op, { toValue: 0, duration: 400, useNativeDriver: true }),
      Animated.timing(op, { toValue: 1, duration: 400, useNativeDriver: true }),
    ])).start();
  }, [op]);
  return <Animated.Text style={{ color: ACCENT, fontSize: 14, opacity: op }}>▋</Animated.Text>;
}

// ─── Typing indicator — R-Lo is "writing" ────────────────────────────────────
function TypingBubble() {
  const d = [
    useRef(new Animated.Value(0.3)).current,
    useRef(new Animated.Value(0.3)).current,
    useRef(new Animated.Value(0.3)).current,
  ];
  useEffect(() => {
    d.forEach((v, i) => {
      Animated.loop(Animated.sequence([
        Animated.delay(i * 150),
        Animated.timing(v, { toValue: 1,   duration: 350, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.3, duration: 350, useNativeDriver: true }),
      ])).start();
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View style={tb.row}>
      <View style={tb.avatarWrap}>
        <MascotImage emotion="rassurante" style={{ width: 32, height: 32 }} />
      </View>
      <View style={tb.bubble}>
        {d.map((v, i) => <Animated.View key={i} style={[tb.dot, { opacity: v }]} />)}
      </View>
    </View>
  );
}
const tb = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 6 },
  avatarWrap:{ width: 32, height: 32 },
  bubble:    { flexDirection: 'row', gap: 5, backgroundColor: CARD, borderRadius: 20, borderBottomLeftRadius: 5, paddingHorizontal: 16, paddingVertical: 14 },
  dot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: SUB },
});

// ─── Message bubble ───────────────────────────────────────────────────────────
function Bubble({ msg }: { msg: LocalMessage }) {
  const isUser = msg.role === 'user';
  return (
    <View style={[bl.row, isUser && bl.rowUser]}>
      {!isUser && (
        <View style={{ width: 32, height: 32, flexShrink: 0 }}>
          <MascotImage emotion="rassurante" style={{ width: 32, height: 32 }} />
        </View>
      )}
      <View style={[bl.bubble, isUser && bl.bubbleUser]}>
        <Text style={[bl.text, isUser && bl.textUser]}>{msg.text}</Text>
      </View>
    </View>
  );
}
const bl = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'flex-end', gap: 8, maxWidth: '88%', marginBottom: 6 },
  rowUser:   { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  bubble:    { backgroundColor: CARD, borderRadius: 20, borderBottomLeftRadius: 5, paddingVertical: 14, paddingHorizontal: 18 },
  bubbleUser:{ backgroundColor: ACCENT, borderBottomLeftRadius: 20, borderBottomRightRadius: 5 },
  text:      { fontSize: 15, lineHeight: 24, color: TEXT },
  textUser:  { color: '#000' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function OnboardingChatScreen() {
  const router            = useRouter();
  const { isAuthenticated } = useAuth();

  const [messages,   setMessages]   = useState<LocalMessage[]>([]);
  const [step,       setStep]       = useState<Step>('greeting');
  const [input,      setInput]      = useState('');
  const [typing,     setTyping]     = useState(false);
  const [firstName,  setFirstName]  = useState('');
  const [wakeTime,   setWakeTime]   = useState<number | null>(null);

  const listRef   = useRef<FlatList<LocalMessage>>(null);

  // ── Scripted message helpers ───────────────────────────────────────────────
  function addMsg(role: LocalMessage['role'], text: string) {
    const msg: LocalMessage = { id: uid(), role, text };
    setMessages(prev => [...prev, msg]);
    return msg;
  }

  function rloSay(text: string, delay = 0): Promise<void> {
    return new Promise(resolve => {
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        addMsg('assistant', text);
        resolve();
      }, delay + 900); // simulate R-Lo typing
    });
  }

  // ── State machine ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 'greeting') return;
    const t = setTimeout(async () => {
      await rloSay("Hi, I'm R-Lo.\nYour personal sleep coach.\n\nWhat should I call you?", 200);
      setStep('q1_name');
    }, 400);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleNameSubmit() {
    const name = input.trim().split(/\s+/)[0] ?? input.trim();
    if (!name) return;
    HapticsLight();
    setInput('');
    addMsg('user', input.trim());
    setFirstName(name);
    setStep('q2_wake');
    await rloSay(
      `Nice to meet you, ${name}! 👋\n\nI'll help you align your day with your natural 90-minute cycles.\n\nWhen do you usually wake up?`,
      300,
    );
  }

  async function handleWakePick(minutes: number, label: string) {
    HapticsLight();
    addMsg('user', label);
    setWakeTime(minutes);
    setStep('q3_goal');
    await rloSay("Got it. What's your main sleep goal right now?", 200);
  }

  async function handleGoalPick(value: string, label: string) {
    HapticsLight();
    addMsg('user', label);
    setStep('done');
    await rloSay("Perfect.\n\nLet's build your R90 recovery rhythm.", 200);

    // Save collected data
    await saveOnboardingData({
      firstName,
      wakeTimeMinutes: wakeTime ?? 390,
      priority:        value,
      constraint:      '',
    });
    await saveChatOnboardingData({
      name:               firstName,
      wakeTime:           WAKE_OPTIONS.find(w => w.value === (wakeTime ?? 390))?.label ?? '06:30',
      mainIssue:          value,
      chronotypeEstimate: '',
      completedAt:        new Date().toISOString(),
    });

    // Navigate: login if not auth'd, otherwise tabs
    setTimeout(() => {
      if (isAuthenticated) {
        router.replace('/(tabs)');
      } else {
        router.replace('/login');
      }
    }, 1800);
  }

  // ── Scroll to bottom ───────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [messages, typing]);

  // ── Option chips ───────────────────────────────────────────────────────────
  function WakeChips() {
    return (
      <View style={oc.wrap}>
        {WAKE_OPTIONS.map(({ label, value }) => (
          <Pressable
            key={label}
            style={({ pressed }) => [oc.chip, pressed && { opacity: 0.7 }]}
            onPress={() => { void handleWakePick(value, label); }}
          >
            <Text style={oc.chipText}>{label}</Text>
          </Pressable>
        ))}
      </View>
    );
  }

  function GoalChips() {
    return (
      <View style={oc.wrap}>
        {GOAL_OPTIONS.map(({ label, value }) => (
          <Pressable
            key={label}
            style={({ pressed }) => [oc.chip, oc.chipWide, pressed && { opacity: 0.7 }]}
            onPress={() => { void handleGoalPick(value, label); }}
          >
            <Text style={oc.chipText}>{label}</Text>
          </Pressable>
        ))}
      </View>
    );
  }

  const showInput    = step === 'q1_name';
  const showWake     = step === 'q2_wake' && !typing;
  const showGoal     = step === 'q3_goal' && !typing;
  const canSend      = input.trim().length > 0;

  return (
    <View style={sc.root}>
      <SafeAreaView style={sc.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={sc.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

          {/* Header */}
          <View style={sc.header}>
            <View style={sc.headerRlo}>
              <MascotImage emotion="encourageant" style={{ width: 32, height: 32 }} />
              <Text style={sc.headerName}>R-Lo</Text>
            </View>
            <Text style={sc.headerSub}>Your personal sleep coach</Text>
          </View>

          {/* Messages */}
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={m => m.id}
            contentContainerStyle={sc.list}
            renderItem={({ item }) => <Bubble msg={item} />}
            ListFooterComponent={typing ? <TypingBubble /> : null}
            showsVerticalScrollIndicator={false}
          />

          {/* Option chips */}
          {showWake && <WakeChips />}
          {showGoal && <GoalChips />}

          {/* Text input (name step only) */}
          {showInput && (
            <View style={sc.inputRow}>
              <View style={sc.inputWrap}>
                <TextInput
                  style={sc.input}
                  placeholder="Your name…"
                  placeholderTextColor={MUTED}
                  value={input}
                  onChangeText={setInput}
                  onSubmitEditing={() => { void handleNameSubmit(); }}
                  returnKeyType="send"
                  autoFocus
                  autoCapitalize="words"
                />
              </View>
              <Pressable
                style={[sc.sendBtn, { backgroundColor: canSend ? ACCENT : SURFACE2 }]}
                onPress={() => { void handleNameSubmit(); }}
                disabled={!canSend}
              >
                <Text style={[sc.sendArrow, { color: canSend ? '#000' : MUTED }]}>↑</Text>
              </Pressable>
            </View>
          )}

        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// ─── Option chips styles ──────────────────────────────────────────────────────
const oc = StyleSheet.create({
  wrap:     { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  chip:     { backgroundColor: CARD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: `${ACCENT}40` },
  chipWide: { flexGrow: 1 },
  chipText: { fontSize: 14, color: TEXT, fontWeight: '500', textAlign: 'center' },
});

// ─── Screen styles ────────────────────────────────────────────────────────────
const sc = StyleSheet.create({
  root:       { flex: 1, backgroundColor: BG },
  safe:       { flex: 1 },
  flex:       { flex: 1 },
  header:     { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: BORDER, gap: 2 },
  headerRlo:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerName: { fontSize: 16, fontWeight: '700', color: TEXT },
  headerSub:  { fontSize: 12, color: MUTED, marginLeft: 40 },
  list:       { padding: 16, paddingBottom: 8, gap: 14 },
  inputRow:   { flexDirection: 'row', alignItems: 'flex-end', padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: BORDER },
  inputWrap:  { flex: 1, backgroundColor: CARD, borderRadius: 22, borderWidth: 1, borderColor: `${ACCENT}40` },
  input:      { paddingHorizontal: 18, paddingVertical: 12, fontSize: 15, color: TEXT, maxHeight: 100 },
  sendBtn:    { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  sendArrow:  { fontSize: 20, fontWeight: '700' },
});
