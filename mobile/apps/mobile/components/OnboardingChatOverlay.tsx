/**
 * OnboardingChatOverlay — steps 6–9 of the R-Lo conversation.
 *
 * Renders as a full-screen dark overlay above the Home screen.
 * Runs a 4-step conversation:
 *   6 – name
 *   7 – wake-up time (workdays)
 *   8 – main sleep issue
 *   9 – chronotype estimate
 *
 * After step 9 R-Lo delivers a closing message, the overlay fades out
 * and calls onComplete() so the app returns to normal Home mode.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MascotImage } from './ui/MascotImage';
import { TypingDots } from './ui/TypingDots';
import { saveChatOnboardingData, type ChatOnboardingData } from '../lib/storage';
import { updateProfile } from '../lib/api';

// ─── Design tokens (always dark — focus-mode overlay) ────────────────────────

const OVERLAY_BG = 'rgba(11,18,32,0.92)';
const SURFACE    = '#1A2436';
const BORDER     = '#243046';
const TEXT       = '#E6EDF7';
const TEXT_SUB   = '#9FB0C5';
const TEXT_MUTED = '#6B7F99';
const ACCENT     = '#33C8E8';
const USER_TEXT  = '#0B1220';

// ─── Question / answer data ───────────────────────────────────────────────────

const WAKE_OPTIONS = ['05:30', '06:00', '06:30', '07:00', '07:30', '08:00', 'Other'] as const;

const ISSUE_OPTIONS = [
  { id: 'tired',      label: 'I feel tired',            icon: '😴' },
  { id: 'cant_sleep', label: "I can't fall asleep",     icon: '🌙' },
  { id: 'wakeup',     label: 'I wake during the night', icon: '⚡' },
  { id: 'chaotic',    label: 'My schedule is chaotic',  icon: '🌀' },
] as const;

const CHRONO_OPTIONS = ['Before 6', '6–7', '7–8', '8–9', 'After 9'] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

type BackendChronotype = 'AMer' | 'PMer' | 'In-betweener' | 'Unknown';

const CHRONO_TO_BACKEND: Record<string, BackendChronotype> = {
  'Before 6': 'AMer',
  '6–7':      'AMer',
  '7–8':      'In-betweener',
  '8–9':      'In-betweener',
  'After 9':  'PMer',
};

type ChatStep = 6 | 7 | 8 | 9;
type Phase =
  | 'typing'        // R-Lo is "typing" its question
  | 'awaiting'      // waiting for user input
  | 'reacting'      // R-Lo is "typing" its reaction
  | 'transitioning' // reaction shown → moving to next step
  | 'fading';       // final message shown → fading out

interface ChatMessage {
  id:   string;
  role: 'rlo' | 'user';
  text: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRloQuestion(step: ChatStep): string {
  switch (step) {
    case 6: return 'What should I call you?';
    case 7: return 'What time do you usually\nwake up on workdays?';
    case 8: return 'What is the biggest issue\nwith your sleep right now?';
    case 9: return 'If you had no schedule,\nwhen would you wake up?';
  }
}

function getRloReaction(step: ChatStep, answer: string): string {
  switch (step) {
    case 6: return `Nice to meet you, ${answer}.`;
    case 7: return 'Good.\n\nThis will become\nyour anchor time.';
    case 8: return "I see.\n\nWe'll adjust your cycles\naround that.";
    case 9: return 'Interesting.\n\nYour biology has\na natural rhythm.';
  }
}


// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  onComplete: () => void;
}

export function OnboardingChatOverlay({ onComplete }: Props) {
  const [step,      setStep]      = useState<ChatStep>(6);
  const [phase,     setPhase]     = useState<Phase>('typing');
  const [messages,  setMessages]  = useState<ChatMessage[]>([]);
  const [nameInput, setNameInput] = useState('');

  // Collected answers — stored in a ref to avoid closure staleness in the phase engine
  const collected = useRef<Omit<ChatOnboardingData, 'completedAt'>>({
    name:               '',
    wakeTime:           '',
    mainIssue:          '',
    chronotypeEstimate: '',
  });
  // The most recent user answer, used by the 'reacting' phase to call getRloReaction
  const currentAnswer = useRef('');

  // Per-message fade+slide animations (keyed by message id)
  const animsRef    = useRef<Record<string, Animated.Value>>({});
  const scrollRef   = useRef<ScrollView>(null);
  const overlayAnim = useRef(new Animated.Value(1)).current;

  // ── Add a message and animate it in ─────────────────────────────────────────
  const addMessage = useCallback((role: 'rlo' | 'user', text: string) => {
    const id   = `${Date.now()}_${role}`;
    const anim = new Animated.Value(0);
    animsRef.current[id] = anim;
    setMessages(prev => [...prev, { id, role, text }]);
    // Animate after the state update has flushed
    setTimeout(() => {
      Animated.timing(anim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    }, 30);
  }, []);

  // ── Auto-scroll to newest message ────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
    return () => clearTimeout(t);
  }, [messages.length]);

  // Scroll when typing indicator appears too
  useEffect(() => {
    if (phase === 'typing' || phase === 'reacting') {
      const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
      return () => clearTimeout(t);
    }
  }, [phase]);

  // ── Phase timing engine ──────────────────────────────────────────────────────
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;

    switch (phase) {
      case 'typing':
        // Show R-Lo question after short typing delay
        t = setTimeout(() => {
          addMessage('rlo', getRloQuestion(step));
          setPhase('awaiting');
        }, step === 6 ? 1000 : 800);
        break;

      case 'reacting':
        // Show R-Lo reaction after typing indicator
        t = setTimeout(() => {
          addMessage('rlo', getRloReaction(step, currentAnswer.current));
          setPhase('transitioning');
        }, 700);
        break;

      case 'transitioning':
        if (step < 9) {
          // Advance to the next question
          t = setTimeout(() => {
            setStep(s => (s + 1) as ChatStep);
            setPhase('typing');
          }, 900);
        } else {
          // All questions done — show closing message then fade out
          t = setTimeout(() => {
            addMessage('rlo', 'Perfect.\n\nLet me build your\nfirst recovery plan.');
            setPhase('fading');
          }, 900);
        }
        break;

      case 'fading': {
        // Save collected data to AsyncStorage
        saveChatOnboardingData({
          ...collected.current,
          completedAt: new Date().toISOString(),
        }).catch(e => console.warn('[OnboardingChat] save failed', e));

        // Normalize and ship to backend
        const { wakeTime, chronotypeEstimate, name, mainIssue } = collected.current;

        const chronotype: BackendChronotype = CHRONO_TO_BACKEND[chronotypeEstimate] ?? 'Unknown';

        let arpTime: string | undefined;
        if (wakeTime && wakeTime !== 'Other' && wakeTime.includes(':')) {
          const [hStr, mStr] = wakeTime.split(':');
          const h = parseInt(hStr, 10);
          const m = parseInt(mStr, 10);
          arpTime = `${String(h).padStart(2, '0')}:${m >= 15 ? '30' : '00'}`;
        }

        updateProfile({
          first_name:              name || undefined,
          self_reported_wake_time: wakeTime !== 'Other' ? wakeTime : undefined,
          sleep_main_issue:        mainIssue || undefined,
          chronotype_estimate:     chronotypeEstimate || undefined,
          chronotype,
          ...(arpTime ? { arp_time: arpTime, arp_committed: true } : {}),
          onboarding_step: 6,
        }).catch(e => console.warn('[OnboardingChat] updateProfile failed', e));

        t = setTimeout(() => {
          Animated.timing(overlayAnim, {
            toValue:         0,
            duration:        800,
            useNativeDriver: true,
          }).start(() => onComplete());
        }, 1500);
        break;
      }
    }

    return () => clearTimeout(t);
  }, [step, phase, addMessage, onComplete, overlayAnim]);

  // ── User submission handler ──────────────────────────────────────────────────
  const handleSubmit = useCallback((answer: string) => {
    const trimmed = answer.trim();
    if (!trimmed) return;

    currentAnswer.current = trimmed;

    // Persist the answer
    switch (step) {
      case 6: collected.current.name               = trimmed; break;
      case 7: collected.current.wakeTime           = trimmed; break;
      case 8: collected.current.mainIssue          = trimmed; break;
      case 9: collected.current.chronotypeEstimate = trimmed; break;
    }

    if (step === 6) setNameInput('');

    addMessage('user', trimmed);
    setPhase('reacting');
  }, [step, addMessage]);

  // ── Input area — changes per step ────────────────────────────────────────────
  const renderInput = () => {
    if (phase !== 'awaiting') return null;

    switch (step) {
      case 6:
        return (
          <View style={s.nameRow}>
            <TextInput
              style={s.nameInput}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Your name"
              placeholderTextColor={TEXT_MUTED}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => handleSubmit(nameInput)}
              maxLength={32}
            />
            <Pressable
              style={[s.sendBtn, !nameInput.trim() && s.sendBtnDisabled]}
              onPress={() => handleSubmit(nameInput)}
              disabled={!nameInput.trim()}
            >
              <Ionicons
                name="arrow-forward"
                size={18}
                color={nameInput.trim() ? USER_TEXT : TEXT_MUTED}
              />
            </Pressable>
          </View>
        );

      case 7:
        return (
          <View style={s.pillGrid}>
            {WAKE_OPTIONS.map(opt => (
              <Pressable key={opt} style={s.pill} onPress={() => handleSubmit(opt)}>
                <Text style={s.pillText}>{opt}</Text>
              </Pressable>
            ))}
          </View>
        );

      case 8:
        return (
          <View style={s.issueList}>
            {ISSUE_OPTIONS.map(opt => (
              <Pressable key={opt.id} style={s.issueCard} onPress={() => handleSubmit(opt.label)}>
                <Text style={s.issueIcon}>{opt.icon}</Text>
                <Text style={s.issueLabel}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>
        );

      case 9:
        return (
          <View style={s.pillGrid}>
            {CHRONO_OPTIONS.map(opt => (
              <Pressable key={opt} style={s.pill} onPress={() => handleSubmit(opt)}>
                <Text style={s.pillText}>{opt}</Text>
              </Pressable>
            ))}
          </View>
        );
    }
  };

  const showTyping = phase === 'typing' || phase === 'reacting';

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <Animated.View style={[s.overlay, { opacity: overlayAnim }]}>
      <KeyboardAvoidingView
        style={s.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <SafeAreaView style={s.safe} edges={['top', 'bottom']}>

          {/* Header — R-Lo identity */}
          <View style={s.header}>
            <MascotImage emotion="rassurante" size="sm" />
            <View style={s.headerMeta}>
              <Text style={s.headerName}>R-Lo</Text>
              <Text style={s.headerSub}>your sleep coach</Text>
            </View>
          </View>

          {/* Message thread */}
          <ScrollView
            ref={scrollRef}
            style={s.thread}
            contentContainerStyle={s.threadContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {messages.map(msg => {
              const anim  = animsRef.current[msg.id] ?? new Animated.Value(1);
              const isRlo = msg.role === 'rlo';
              return (
                <Animated.View
                  key={msg.id}
                  style={[
                    s.msgRow,
                    isRlo ? s.msgRowRlo : s.msgRowUser,
                    {
                      opacity:   anim,
                      transform: [{
                        translateY: anim.interpolate({
                          inputRange:  [0, 1],
                          outputRange: [10, 0],
                        }),
                      }],
                    },
                  ]}
                >
                  <View style={[s.bubble, isRlo ? s.bubbleRlo : s.bubbleUser]}>
                    <Text style={[s.bubbleText, isRlo ? s.bubbleTextRlo : s.bubbleTextUser]}>
                      {msg.text}
                    </Text>
                  </View>
                </Animated.View>
              );
            })}

            {showTyping && (
              <View style={s.msgRowRlo}>
                <TypingDots />
              </View>
            )}

            <View style={{ height: 8 }} />
          </ScrollView>

          {/* Input area */}
          <View style={s.inputArea}>
            {renderInput()}
          </View>

        </SafeAreaView>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Overlay
  overlay: {
    position:        'absolute',
    top:             0,
    left:            0,
    right:           0,
    bottom:          0,
    backgroundColor: OVERLAY_BG,
  },
  kav:  { flex: 1 },
  safe: { flex: 1 },

  // Header
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 20,
    paddingTop:        8,
    paddingBottom:     12,
    gap:               12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  headerMeta: { gap: 2 },
  headerName: {
    fontSize:   16,
    fontFamily: 'Inter-SemiBold',
    fontWeight: '600',
    color:      TEXT,
  },
  headerSub: {
    fontSize:   12,
    fontFamily: 'Inter-Regular',
    color:      TEXT_MUTED,
  },

  // Message thread
  thread:        { flex: 1 },
  threadContent: { paddingHorizontal: 20, paddingTop: 16, gap: 8 },

  // Message rows
  msgRow:     { maxWidth: '80%' },
  msgRowRlo:  { alignSelf: 'flex-start' },
  msgRowUser: { alignSelf: 'flex-end'   },

  // Bubbles
  bubble: {
    borderRadius:    18,
    paddingHorizontal: 16,
    paddingVertical:   12,
  },
  bubbleRlo: {
    backgroundColor:     SURFACE,
    borderTopLeftRadius: 4,
    borderWidth:         1,
    borderColor:         BORDER,
  },
  bubbleUser: {
    backgroundColor:      ACCENT,
    borderTopRightRadius: 4,
  },
  bubbleText: {
    fontSize:   16,
    fontFamily: 'Inter-Regular',
    lineHeight: 24,
  },
  bubbleTextRlo:  { color: TEXT      },
  bubbleTextUser: { color: USER_TEXT, fontFamily: 'Inter-Medium', fontWeight: '500' },

  // Input area wrapper
  inputArea: {
    paddingHorizontal: 20,
    paddingTop:        12,
    paddingBottom:     8,
    borderTopWidth:    1,
    borderTopColor:    BORDER,
  },

  // Step 6 — name input
  nameRow: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: SURFACE,
    borderRadius:    14,
    borderWidth:     1,
    borderColor:     BORDER,
    paddingLeft:     16,
    paddingRight:    6,
    gap:             8,
  },
  nameInput: {
    flex:       1,
    height:     48,
    color:      TEXT,
    fontSize:   16,
    fontFamily: 'Inter-Regular',
  },
  sendBtn: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: ACCENT,
    justifyContent:  'center',
    alignItems:      'center',
  },
  sendBtnDisabled: {
    backgroundColor: BORDER,
  },

  // Steps 7 & 9 — pill grid
  pillGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           10,
  },
  pill: {
    backgroundColor:   SURFACE,
    borderRadius:      9999,
    borderWidth:       1,
    borderColor:       BORDER,
    paddingHorizontal: 20,
    paddingVertical:   11,
  },
  pillText: {
    fontSize:   15,
    fontFamily: 'Inter-Medium',
    fontWeight: '500',
    color:      TEXT,
  },

  // Step 8 — issue cards
  issueList: { gap: 8 },
  issueCard: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   SURFACE,
    borderRadius:      14,
    borderWidth:       1,
    borderColor:       BORDER,
    paddingHorizontal: 16,
    paddingVertical:   13,
    gap:               12,
  },
  issueIcon:  { fontSize: 18 },
  issueLabel: {
    fontSize:   15,
    fontFamily: 'Inter-Medium',
    fontWeight: '500',
    color:      TEXT,
  },
});
