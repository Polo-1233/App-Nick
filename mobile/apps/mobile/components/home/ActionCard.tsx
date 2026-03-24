/**
 * PrimaryActionCard (ActionCard)
 *
 * The most dominant card on the screen.
 * Matches reference: rich blue card with icon + text block + right-side CTA button.
 *
 * Layout:
 *   [Icon]  [Title / Subtitle]  [CTA button]
 *
 * Rules:
 *   - ONE action only, never two buttons
 *   - Button on the right (pill shape)
 *   - Icon on the left (color-coded circle)
 *   - Scale animation on press (0.97 → 1)
 */

import { useRef, memo } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NextAction } from '@r90/types';
import { nowMin } from '../../lib/time-utils';
import type { MissedCycleInfo } from '../../lib/missed-cycle';

// ─── Tokens ─────────────────────────────────────────────────────────────────────
const DEEP   = '#141466';
const ACCENT = '#1c9fda';
const GOLD   = '#F5A623';
const WHITE  = '#FFFFFF';

// ─── Types ──────────────────────────────────────────────────────────────────────
interface ActionCardProps {
  action:       NextAction | null;
  missedCycle?: MissedCycleInfo | null;
  onPress:      () => void;
}

interface Display {
  icon:      string;
  iconColor: string;
  title:     string;
  subtitle:  string;
  cta:       string | null;
}

// ─── Build display data ──────────────────────────────────────────────────────────
function build(
  action:      NextAction | null,
  now:         number,
  missedCycle?: MissedCycleInfo | null,
): Display {

  if (missedCycle?.missed) {
    return {
      icon: 'moon-outline', iconColor: ACCENT,
      title:    `Next window: ${missedCycle.nextWindow}`,
      subtitle: `${missedCycle.cyclesRemaining} cycles — still a good night.`,
      cta:      null,
    };
  }

  if (!action) {
    return {
      icon: 'checkmark-circle-outline', iconColor: '#4ADE80',
      title:    'Your rhythm is on track',
      subtitle: 'Rest and stay consistent.',
      cta:      null,
    };
  }

  const diff  = action.scheduledAt !== undefined ? action.scheduledAt - now : null;
  const inMin = diff !== null && diff > 0 ? ` in ${diff} min` : '';

  switch (action.type) {
    case 'wake_up':
      return {
        icon: 'sunny-outline', iconColor: GOLD,
        title: 'Confirm your wake-up',
        subtitle: 'Tap to log your night.',
        cta: 'Confirm (+5)',
      };
    case 'take_mrm':
    case 'mrm_reminder':
      return {
        icon: 'flash-outline', iconColor: ACCENT,
        title: `Reset${inMin}`,
        subtitle: '2-minute breathing break.',
        cta: 'Start →',
      };
    case 'take_crp':
      return {
        icon: 'flash-outline', iconColor: GOLD,
        title: `Recovery time`,
        subtitle: `CRP${inMin} — 20 min recovery`,
        cta: 'Start →',
      };
    case 'crp_reminder':
      return {
        icon: 'flash', iconColor: GOLD,
        title: 'Recovery now',
        subtitle: 'Your 20-min window is open.',
        cta: 'Start →',
      };
    case 'start_pre_sleep':
      return {
        icon: 'moon-outline', iconColor: ACCENT,
        title: `Wind-down${inMin}`,
        subtitle: 'Start stepping away from screens.',
        cta: diff !== null && diff <= 0 ? 'Start →' : null,
      };
    case 'go_to_sleep':
      return {
        icon: 'bed-outline', iconColor: ACCENT,
        title: 'Sleep window open',
        subtitle: 'Your body is ready.',
        cta: null,
      };
    default:
      return {
        icon: 'navigate-circle-outline', iconColor: ACCENT,
        title:    action.title,
        subtitle: action.description ?? '',
        cta:      null,
      };
  }
}

// ─── Component ───────────────────────────────────────────────────────────────────
export const ActionCard = memo(function ActionCard({
  action, missedCycle, onPress,
}: ActionCardProps) {
  const disp  = build(action, nowMin(), missedCycle);
  const scale = useRef(new Animated.Value(1)).current;

  function handlePress() {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.97, duration: 80,  useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1.00, duration: 120, useNativeDriver: true }),
    ]).start(() => onPress());
  }

  return (
    <Pressable onPress={handlePress} accessibilityRole="button" accessibilityLabel={disp.title}>
      <Animated.View style={[ac.card, { transform: [{ scale }] }]}>

        {/* Icon circle */}
        <View style={[ac.iconWrap, { backgroundColor: `${disp.iconColor}22` }]}>
          <Ionicons name={disp.icon as any} size={22} color={disp.iconColor} />
        </View>

        {/* Text block */}
        <View style={ac.body}>
          <Text style={ac.title} numberOfLines={1}>{disp.title}</Text>
          {!!disp.subtitle && (
            <Text style={ac.subtitle} numberOfLines={2}>{disp.subtitle}</Text>
          )}
        </View>

        {/* CTA — right side pill */}
        {disp.cta !== null && (
          <View style={ac.ctaPill}>
            <Text style={ac.ctaLabel}>{disp.cta}</Text>
          </View>
        )}

      </Animated.View>
    </Pressable>
  );
});

// ─── Styles ──────────────────────────────────────────────────────────────────────
const ac = StyleSheet.create({
  card: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             14,
    marginHorizontal: 20,
    marginTop:        16,
    padding:          18,
    borderRadius:     18,
    backgroundColor:  DEEP,
    shadowColor:      DEEP,
    shadowOffset:     { width: 0, height: 4 },
    shadowOpacity:    0.15,
    shadowRadius:     16,
    elevation:        4,
  },
  iconWrap: {
    width:          46,
    height:         46,
    borderRadius:   14,
    alignItems:     'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap:  3,
  },
  title: {
    fontSize:   15,
    fontWeight: '700',
    color:      WHITE,
    lineHeight: 20,
  },
  subtitle: {
    fontSize:  13,
    color:     'rgba(255,255,255,0.65)',
    lineHeight: 18,
  },
  ctaPill: {
    backgroundColor: ACCENT,
    borderRadius:    20,
    paddingHorizontal: 14,
    paddingVertical:    8,
  },
  ctaLabel: {
    fontSize:   13,
    fontWeight: '700',
    color:      WHITE,
  },
});
