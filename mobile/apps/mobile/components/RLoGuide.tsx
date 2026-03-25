/**
 * RLoGuide — Premium onboarding overlay system
 *
 * Two modes:
 *   1. Spotlight overlay (Layer 1): full-screen dim with spotlight hole + bubble
 *   2. Contextual tooltip (Layer 2): inline bubble attached to a feature
 *
 * Usage:
 *
 *   // Layer 1 — Spotlight overlay (used in HomeScreen)
 *   <RLoSpotlight
 *     visible={showStep}
 *     message="This is your day, built around your natural rhythm."
 *     spotlightY={timelineY}       // vertical center of highlighted element
 *     spotlightHeight={80}         // height of spotlight hole
 *     onNext={handleNext}
 *     onSkip={handleSkip}
 *     step={1}
 *     totalSteps={3}
 *   />
 *
 *   // Layer 2 — Contextual tooltip (used inline in any screen)
 *   <RLoTooltip
 *     visible={showTip}
 *     message="This is a reset moment. It helps you stay sharp."
 *     onDismiss={() => markSeen()}
 *   />
 */

import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
} from 'react-native';
import { MascotImage } from './ui/MascotImage';

const { width: SW, height: SH } = Dimensions.get('window');

// ─── Design tokens ────────────────────────────────────────────────────────────

const ACCENT    = '#1c9fda';
const BG_DIM    = 'rgba(5,5,30,0.75)';
const CARD_BG   = '#141466';
const BORDER    = 'rgba(28,159,218,0.15)';
const TEXT_CLR  = '#E6EDF7';
const TEXT_SUB  = '#9FB0C5';
const TEXT_MUTED = '#6B8CAE';

// ─── RLoSpotlight (Layer 1) ───────────────────────────────────────────────────

interface SpotlightProps {
  visible:         boolean;
  message:         string;
  spotlightY?:     number;    // Y center of the spotlight hole (from top)
  spotlightHeight?: number;   // height of the spotlight opening
  onNext:          () => void;
  onSkip:          () => void;
  step:            number;    // current step (1-based)
  totalSteps:      number;
}

export function RLoSpotlight({
  visible,
  message,
  spotlightY = SH * 0.35,
  spotlightHeight = 80,
  onNext,
  onSkip,
  step,
  totalSteps,
}: SpotlightProps) {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (visible) {
      fadeAnim.setValue(0);
      slideAnim.setValue(20);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, message]);

  if (!visible) return null;

  // Position bubble below the spotlight hole
  const bubbleTop = spotlightY + spotlightHeight / 2 + 24;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Dim overlay — tap anywhere to advance */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onNext}>
        {/* Top dim */}
        <View style={[sl.dimBlock, {
          top: 0,
          height: Math.max(0, spotlightY - spotlightHeight / 2),
        }]} />
        {/* Bottom dim */}
        <View style={[sl.dimBlock, {
          top: spotlightY + spotlightHeight / 2,
          bottom: 0,
        }]} />
        {/* Left dim (beside spotlight) */}
        <View style={[sl.dimBlock, {
          top: spotlightY - spotlightHeight / 2,
          height: spotlightHeight,
          left: 0,
          width: 16,
        }]} />
        {/* Right dim (beside spotlight) */}
        <View style={[sl.dimBlock, {
          top: spotlightY - spotlightHeight / 2,
          height: spotlightHeight,
          right: 0,
          width: 16,
        }]} />
      </Pressable>

      {/* Bubble card */}
      <Animated.View
        style={[sl.bubble, {
          top: bubbleTop,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        }]}
        pointerEvents="box-none"
      >
        <View style={sl.bubbleInner}>
          {/* Mascot + message */}
          <View style={sl.row}>
            <View style={sl.mascotWrap}>
              <MascotImage emotion="encourageant" style={sl.mascotImg} />
            </View>
            <View style={sl.textWrap}>
              <Text style={sl.message}>{message}</Text>
            </View>
          </View>

          {/* Footer: dots + skip */}
          <View style={sl.footer}>
            <View style={sl.dots}>
              {Array.from({ length: totalSteps }, (_, i) => (
                <View
                  key={i}
                  style={[sl.dot, i + 1 === step && sl.dotActive]}
                />
              ))}
            </View>
            <Pressable onPress={onSkip} hitSlop={12}>
              <Text style={sl.skipText}>Skip</Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const sl = StyleSheet.create({
  dimBlock: {
    position: 'absolute',
    backgroundColor: BG_DIM,
    left: 0,
    right: 0,
  },
  bubble: {
    position: 'absolute',
    left: 20,
    right: 20,
  },
  bubbleInner: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 14,
    // subtle shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  mascotWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    flexShrink: 0,
  },
  mascotImg: {
    width: 40,
    height: 40,
  },
  textWrap: {
    flex: 1,
  },
  message: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_CLR,
    lineHeight: 23,
    letterSpacing: -0.2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  dotActive: {
    backgroundColor: ACCENT,
    width: 18,
    borderRadius: 3,
  },
  skipText: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_MUTED,
  },
});

// ─── RLoTooltip (Layer 2) ─────────────────────────────────────────────────────

interface TooltipProps {
  visible:    boolean;
  message:    string;
  onDismiss:  () => void;
}

export function RLoTooltip({ visible, message, onDismiss }: TooltipProps) {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    if (visible) {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.95);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1,  duration: 350, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1,  useNativeDriver: true, speed: 14, bounciness: 4 }),
      ]).start();
    } else {
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[tt.wrap, {
      opacity: fadeAnim,
      transform: [{ scale: scaleAnim }],
    }]}>
      <View style={tt.card}>
        <View style={tt.row}>
          <View style={tt.mascotWrap}>
            <MascotImage emotion="rassurante" style={tt.mascotImg} />
          </View>
          <Text style={tt.message}>{message}</Text>
        </View>
        <Pressable style={tt.dismissBtn} onPress={onDismiss}>
          <Text style={tt.dismissText}>Got it</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const tt = StyleSheet.create({
  wrap: {
    marginHorizontal: 20,
    marginVertical: 8,
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mascotWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    flexShrink: 0,
  },
  mascotImg: {
    width: 32,
    height: 32,
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: TEXT_CLR,
    lineHeight: 21,
  },
  dismissBtn: {
    alignSelf: 'flex-end',
    backgroundColor: `${ACCENT}18`,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  dismissText: {
    fontSize: 13,
    fontWeight: '700',
    color: ACCENT,
  },
});
