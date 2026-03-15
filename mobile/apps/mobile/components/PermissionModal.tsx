/**
 * PermissionModal — soft popup for calendar + notification permission requests.
 *
 * Design: dark dimmed overlay + white card (frosted-glass feel without blur lib).
 * Animation: entrance = fade backdrop + spring-slide card up.
 *            step change = crossfade content (calendar → notifications).
 *
 * Used after onboarding completion; caller controls step state machine.
 */

import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PermStep = 'calendar' | 'notifications';

interface Props {
  visible: boolean;
  step: PermStep;
  /** Called when user taps "Allow". Must be async — handles OS permission prompt. */
  onAllow: () => Promise<void>;
  /** Called when user taps "Not now" or the × button. */
  onSkip: () => void;
}

// ─── Content ─────────────────────────────────────────────────────────────────

const CONTENT: Record<PermStep, { title: string; description: string }> = {
  calendar: {
    title: 'Connect your calendar',
    description:
      'R90 reads your schedule to flag conflicts with your sleep windows and suggest the right adjustments.',
  },
  notifications: {
    title: 'Enable notifications',
    description:
      "Get a gentle nudge when it\u2019s time to start your pre-sleep routine or take a midday recovery nap.",
  },
};

const MASCOT = require('../assets/images/rlo-hello.png');

const GREEN = '#22C55E';

// ─── Component ───────────────────────────────────────────────────────────────

export function PermissionModal({ visible, step, onAllow, onSkip }: Props) {
  const [loading, setLoading] = useState(false);

  // Entrance animations
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  // Small downward offset so the card feels like it "lands" into place
  const cardTranslateY  = useRef(new Animated.Value(18)).current;
  const cardScale       = useRef(new Animated.Value(0.95)).current;

  // Content crossfade (calendar ↔ notifications)
  const contentOpacity  = useRef(new Animated.Value(1)).current;
  // Tracks whether the modal has already played its entrance animation,
  // so subsequent step changes trigger a crossfade instead.
  const enteredRef = useRef(false);

  // ── Entrance / exit ───────────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      enteredRef.current = false;
      backdropOpacity.setValue(0);
      cardTranslateY.setValue(18);
      cardScale.setValue(0.95);
      contentOpacity.setValue(1);

      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(cardTranslateY, {
          toValue: 0,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.timing(cardScale, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }),
      ]).start(() => {
        enteredRef.current = true;
      });
    } else {
      enteredRef.current = false;
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Content crossfade on step change ──────────────────────────────────────
  useEffect(() => {
    if (!visible || !enteredRef.current) return;
    Animated.sequence([
      Animated.timing(contentOpacity, {
        toValue: 0,
        duration: 110,
        useNativeDriver: true,
      }),
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Allow handler with loading guard ─────────────────────────────────────
  const mounted = useRef(true);
  useEffect(() => { return () => { mounted.current = false; }; }, []);

  async function handleAllow() {
    if (loading) return;
    setLoading(true);
    await onAllow();
    if (mounted.current) setLoading(false);
  }

  const content = CONTENT[step];

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={onSkip}
    >
      {/* ── Backdrop ── */}
      <Animated.View style={[s.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onSkip} />
      </Animated.View>

      {/* ── Card ── */}
      <View style={s.centeredContainer} pointerEvents="box-none">
        <Animated.View
          style={[
            s.card,
            {
              transform: [
                { translateY: cardTranslateY },
                { scale: cardScale },
              ],
              opacity: backdropOpacity, // card shares backdrop fade-in
            },
          ]}
        >
          {/* × dismiss */}
          <Pressable style={s.closeBtn} onPress={onSkip} hitSlop={12}>
            <Text style={s.closeTxt}>✕</Text>
          </Pressable>

          {/* Animated content block */}
          <Animated.View style={[s.content, { opacity: contentOpacity }]}>
            {/* Mascot */}
            <View style={s.mascotWrap}>
              <Image source={MASCOT} style={s.mascot} resizeMode="contain" />
            </View>

            {/* Text */}
            <Text style={s.title}>{content.title}</Text>
            <Text style={s.description}>{content.description}</Text>

            {/* Buttons */}
            <Pressable
              style={[s.allowBtn, loading && s.allowBtnDisabled]}
              onPress={handleAllow}
              disabled={loading}
            >
              <Text style={s.allowBtnTxt}>
                {loading ? 'Requesting…' : 'Allow'}
              </Text>
            </Pressable>

            <Pressable style={s.skipBtn} onPress={onSkip} disabled={loading}>
              <Text style={s.skipBtnTxt}>Not now</Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Backdrop
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  // Card centering wrapper — true center, not bottom-sheet
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  // Card itself — constrained width for tablets/landscape
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    paddingTop: 20,
    paddingHorizontal: 24,
    paddingBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 20,
  },
  // × button
  closeBtn: {
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  closeTxt: {
    fontSize: 16,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  // Content
  content: {
    alignItems: 'center',
  },
  // Mascot
  mascotWrap: {
    marginVertical: 12,
  },
  mascot: {
    width: 80,
    height: 80,
  },
  // Text
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 10,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 28,
  },
  // Allow button
  allowBtn: {
    backgroundColor: GREEN,
    borderRadius: 14,
    paddingVertical: 16,
    alignSelf: 'stretch',
    alignItems: 'center',
    marginBottom: 12,
  },
  allowBtnDisabled: {
    opacity: 0.6,
  },
  allowBtnTxt: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  // Skip button
  skipBtn: {
    paddingVertical: 6,
    alignItems: 'center',
  },
  skipBtnTxt: {
    color: '#9CA3AF',
    fontSize: 15,
    fontWeight: '500',
  },
});
