/**
 * OnboardingChatFlow — Guided onboarding chat UI
 *
 * Extracted from HomeScreen.tsx for clarity and maintainability.
 * Handles: greeting → name → wake time → goal → advance('plan')
 *
 * Props:
 *   messages      — chat messages from useChat()
 *   isThinking    — show ThinkingDots indicator
 *   isStreaming   — block input while streaming
 *   injectMessage — inject a message into the chat
 *   advance       — advance onboarding phase
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView, Animated, Platform, Pressable, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView }    from 'react-native-safe-area-context';
import { LinearGradient }  from 'expo-linear-gradient';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons }        from '@expo/vector-icons';
import { CircadianBackground } from './CircadianBackground';
import { saveOnboardingData }  from '../lib/storage';
import type { ChatMessage }    from '../lib/use-chat';

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const BG   = '#0a0a3a';
const CARD = '#141466';
const ACCENT = '#1c9fda';
const TEXT   = '#FFFFFF';
const SUB    = '#A8C4E0';

// ─── Types ────────────────────────────────────────────────────────────────────
type OnboardingStep = 'greeting' | 'name' | 'wake' | 'goal' | 'summary' | 'done';

export interface OnboardingChatFlowProps {
  messages:      ChatMessage[];
  isThinking:    boolean;
  isStreaming:   boolean;
  injectMessage: (text: string, role?: string) => void;
  advance:       (phase: string) => void;
}

// ─── BlinkingCursor ───────────────────────────────────────────────────────────
function BlinkingCursor() {
  const op = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(op, { toValue: 0, duration: 500, useNativeDriver: true }),
      Animated.timing(op, { toValue: 1, duration: 500, useNativeDriver: true }),
    ])).start();
  }, [op]);
  return <Animated.Text style={{ color: ACCENT, fontSize: 14, opacity: op }}>▋</Animated.Text>;
}

// ─── ThinkingDots ─────────────────────────────────────────────────────────────
function ThinkingDots() {
  const dots = [
    useRef(new Animated.Value(0.3)).current,
    useRef(new Animated.Value(0.3)).current,
    useRef(new Animated.Value(0.3)).current,
  ];
  useEffect(() => {
    const loop = (d: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(d, { toValue: 1,   duration: 300, useNativeDriver: true }),
        Animated.timing(d, { toValue: 0.3, duration: 300, useNativeDriver: true }),
      ])).start();
    dots.forEach((d, i) => loop(d, i * 150));
  }, []);
  return (
    <View style={{ flexDirection: 'row', gap: 4, paddingHorizontal: 4, paddingVertical: 2 }}>
      {dots.map((d, i) => (
        <Animated.View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: SUB, opacity: d }} />
      ))}
    </View>
  );
}

// ─── ChatBubble ───────────────────────────────────────────────────────────────
function ChatBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';
  return (
    <View style={[cb.wrap, isUser ? cb.wrapUser : cb.wrapBot]}>
      {!isUser && (
        <View style={cb.avatar}>
          <Text style={{ fontSize: 10, color: ACCENT, fontWeight: '800' }}>R</Text>
        </View>
      )}
      <View style={[cb.bubble, isUser ? cb.bubbleUser : cb.bubbleBot]}>
        {msg.status === 'streaming'
          ? <BlinkingCursor />
          : <Text style={[cb.text, isUser && { color: BG }]}>{msg.content}</Text>
        }
      </View>
    </View>
  );
}

const cb = StyleSheet.create({
  wrap:       { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginVertical: 3, paddingHorizontal: 16 },
  wrapUser:   { justifyContent: 'flex-end' },
  wrapBot:    { justifyContent: 'flex-start' },
  avatar:     { width: 24, height: 24, borderRadius: 12, backgroundColor: `${ACCENT}25`, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${ACCENT}40` },
  bubble:     { maxWidth: '78%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleBot:  { backgroundColor: CARD, borderBottomLeftRadius: 4 },
  bubbleUser: { backgroundColor: ACCENT, borderBottomRightRadius: 4 },
  text:       { fontSize: 14, color: TEXT, lineHeight: 20 },
});

// ─── OnboardingPill ───────────────────────────────────────────────────────────
function OnboardingPill({ step }: { step: OnboardingStep }) {
  const stepLabels: Record<string, string> = {
    greeting: 'Welcome', name: 'Your name', wake: 'Wake time',
    goal: 'Your goal', summary: 'Summary', done: 'Done',
  };
  return (
    <View style={op.wrap}>
      <View style={op.pill}>
        <Text style={op.text}>{stepLabels[step] ?? 'Setup'}</Text>
      </View>
    </View>
  );
}

const op = StyleSheet.create({
  wrap: { position: 'absolute', top: 14, left: 0, right: 0, alignItems: 'center', zIndex: 10 },
  pill: { backgroundColor: 'rgba(28,159,218,0.2)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: `${ACCENT}40` },
  text: { fontSize: 12, fontWeight: '700', color: ACCENT, letterSpacing: 0.5 },
});

// ─── Main Component ───────────────────────────────────────────────────────────
export function OnboardingChatFlow({
  messages, isThinking, injectMessage, advance,
}: OnboardingChatFlowProps) {
  const scrollRef         = useRef<ScrollView>(null);
  const inputRef          = useRef<TextInput>(null);
  const [step, setStep]   = useState<OnboardingStep>('greeting');
  const [input, setInput] = useState('');
  const dataRef           = useRef({ name: '', wakeMin: 450, wakeLabel: '7:30', goal: '' });

  // Boot greeting sequence
  useEffect(() => {
    const t = setTimeout(() => {
      setStep('greeting');
      injectMessage("Hi, I'm R-Lo.\nYour personal sleep coach.");
      setTimeout(() => {
        injectMessage("What's your name?");
        setStep('name');
      }, 1200);
    }, 400);
    return () => clearTimeout(t);
  }, []);

  const handleReply = useCallback(async (txt: string) => {
    const d = dataRef.current;
    switch (step) {
      case 'name': {
        d.name = txt.trim() || 'there';
        injectMessage(`Nice to meet you, ${d.name}. 🙂`);
        await new Promise(r => setTimeout(r, 800));
        injectMessage('What time do you usually wake up?');
        setStep('wake');
        break;
      }
      case 'wake': {
        const match = txt.match(/(\d{1,2})[:h]?(\d{0,2})/);
        if (match) {
          const h = parseInt(match[1]);
          const m = parseInt(match[2] || '0');
          d.wakeMin   = h * 60 + m;
          d.wakeLabel = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        } else {
          d.wakeLabel = txt;
        }
        injectMessage(`Got it — ${d.wakeLabel} wake-up. 🌅`);
        await new Promise(r => setTimeout(r, 800));
        injectMessage('What would you like to improve most?\n\n1. More energy during the day\n2. Fall asleep faster\n3. Better recovery\n4. Manage jet lag / travel');
        setStep('goal');
        break;
      }
      case 'goal': {
        const map: Record<string, string> = { '1': 'energy', '2': 'sleep_speed', '3': 'recovery', '4': 'travel' };
        d.goal = map[txt.trim()] ?? (
          txt.toLowerCase().includes('energy')   ? 'energy'   :
          txt.toLowerCase().includes('fast')     ? 'sleep_speed' :
          txt.toLowerCase().includes('recover')  ? 'recovery' : 'energy'
        );
        injectMessage('Perfect. Building your personalised R90 plan...');
        setStep('summary');
        await saveOnboardingData({ firstName: d.name, wakeTimeMinutes: d.wakeMin, priority: d.goal, constraint: '' });
        await new Promise(r => setTimeout(r, 1500));
        advance('plan');
        break;
      }
    }
  }, [step, injectMessage, advance]);

  const handleSend = useCallback(() => {
    const txt = input.trim();
    if (!txt || step === 'greeting' || step === 'summary' || step === 'done') return;
    setInput('');
    injectMessage(txt, 'user');
    void handleReply(txt);
  }, [input, step, injectMessage, handleReply]);

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {Platform.OS === 'ios'
        ? <Video source={require('../assets/animation-v2.mp4')} style={StyleSheet.absoluteFill} resizeMode={ResizeMode.COVER} shouldPlay isLooping isMuted useNativeControls={false} />
        : <CircadianBackground />
      }
      <LinearGradient
        colors={['rgba(10,10,58,0.55)', 'rgba(10,10,58,0.80)']}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <OnboardingPill step={step} />

        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingVertical: 60, paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((m, i) => <ChatBubble key={i} msg={m} />)}
          {isThinking && (
            <View style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
              <View style={[cb.bubble, cb.bubbleBot]}>
                <ThinkingDots />
              </View>
            </View>
          )}
        </ScrollView>

        {/* Input bar */}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.inputRow}>
            <TextInput
              ref={inputRef}
              style={s.inputField}
              value={input}
              onChangeText={setInput}
              placeholder="Type a message…"
              placeholderTextColor="#6B8CAE"
              returnKeyType="send"
              onSubmitEditing={handleSend}
              editable={step !== 'greeting' && step !== 'summary' && step !== 'done'}
            />
            <Pressable
              onPress={handleSend}
              style={[s.sendBtn, (!input.trim() || step === 'greeting') && s.sendBtnDisabled]}
              disabled={!input.trim() || step === 'greeting'}
            >
              <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// Expose handleReply so HomeScreen can wire up text input
OnboardingChatFlow.displayName = 'OnboardingChatFlow';

const s = StyleSheet.create({
  inputRow: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             10,
    paddingHorizontal: 16,
    paddingBottom:   16,
    paddingTop:      8,
  },
  inputField: {
    flex:             1,
    backgroundColor:  CARD,
    borderRadius:     24,
    paddingHorizontal: 18,
    paddingVertical:  12,
    borderWidth:      1,
    borderColor:      `${ACCENT}30`,
    color:            '#FFFFFF',
    fontSize:         14,
  },
  sendBtn: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: ACCENT,
    alignItems:      'center',
    justifyContent:  'center',
  },
  sendBtnDisabled: {
    backgroundColor: `${ACCENT}40`,
  },
});
