/**
 * ActionCard — dominant UI element on HomeScreen
 *
 * Hierarchy:
 *   1. Dynamic title    — large, tells the user WHAT to do
 *   2. Subtitle         — optional context (small, muted)
 *   3. ONE CTA button   — full-width, blue, 48px
 *
 * Rules:
 *   - Never more than 1 button
 *   - Title changes based on next action
 *   - Press triggers micro scale animation (0.97 → 1)
 */

import { useRef, memo } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import type { NextAction } from '@r90/types';
import { nowMin } from '../../lib/time-utils';
import type { MissedCycleInfo } from '../../lib/missed-cycle';

// ─── Design tokens ─────────────────────────────────────────────────────────────
const TEXT_PRIMARY = '#002060';
const TEXT_MUTED   = '#6B7A90';
const ACCENT       = '#1c9fda';
const GOLD         = '#F5A623';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface ActionCardProps {
  action:       NextAction | null;
  missedCycle?: MissedCycleInfo | null;
  onPress:      () => void;
}

interface DisplayData {
  title:    string;
  subtitle: string;
  cta:      string | null;   // null = no button
}

// ─── Build display data from action ────────────────────────────────────────────
function buildDisplay(
  action:      NextAction | null,
  now:         number,
  missedCycle?: MissedCycleInfo | null,
): DisplayData {

  // Missed window takes priority
  if (missedCycle?.missed) {
    return {
      title:    `Next window: ${missedCycle.nextWindow}`,
      subtitle: `${missedCycle.cyclesRemaining} cycles — still a good night.`,
      cta:      null,
    };
  }

  // No action — rhythm is on track
  if (!action) {
    return {
      title:    'Your rhythm is on track',
      subtitle: '',
      cta:      null,
    };
  }

  const diff   = action.scheduledAt !== undefined ? action.scheduledAt - now : null;
  const inMin  = diff !== null && diff > 0 ? ` in ${diff} min` : '';

  switch (action.type) {
    case 'wake_up':
      return {
        title:    'Confirm your wake-up',
        subtitle: 'Log your night to track your rhythm.',
        cta:      'Confirm (+5)',
      };

    case 'take_mrm':
    case 'mrm_reminder':
      return {
        title:    `Reset${inMin}`,
        subtitle: '2-minute breathing break.',
        cta:      'Start',
      };

    case 'take_crp':
      return {
        title:    `Recovery${inMin}`,
        subtitle: '20-min window — essential today.',
        cta:      'Start',
      };

    case 'crp_reminder':
      return {
        title:    'Recovery now',
        subtitle: 'Your 20-min window is open.',
        cta:      'Start',
      };

    case 'start_pre_sleep':
      return {
        title:    `Wind-down${inMin}`,
        subtitle: 'Start stepping away from screens.',
        cta:      diff !== null && diff <= 0 ? 'Start' : null,
      };

    case 'go_to_sleep':
      return {
        title:    'Sleep window open',
        subtitle: 'Your body is ready.',
        cta:      null,
      };

    case 'anchor_reminder':
      return {
        title:    action.title,
        subtitle: action.description ?? '',
        cta:      null,
      };

    default:
      return {
        title:    action.title,
        subtitle: action.description ?? '',
        cta:      null,
      };
  }
}

// ─── Component ─────────────────────────────────────────────────────────────────
export const ActionCard = memo(function ActionCard({
  action, missedCycle, onPress,
}: ActionCardProps) {
  const now   = nowMin();
  const disp  = buildDisplay(action, now, missedCycle);
  const scale = useRef(new Animated.Value(1)).current;

  function handlePress() {
    // Micro scale feedback: 0.97 → 1
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.97, duration: 80,  useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1.00, duration: 120, useNativeDriver: true }),
    ]).start(() => onPress());
  }

  return (
    <Pressable
      onPress={handlePress}
      accessible
      accessibilityRole="button"
      accessibilityLabel={disp.title}
    >
      <Animated.View style={[ac.card, { transform: [{ scale }] }]}>

        {/* Title */}
        <Text style={ac.title}>{disp.title}</Text>

        {/* Subtitle */}
        {!!disp.subtitle && (
          <Text style={ac.subtitle}>{disp.subtitle}</Text>
        )}

        {/* CTA — only 1, only if needed */}
        {disp.cta !== null && (
          <View style={ac.cta}>
            <Text style={ac.ctaLabel}>{disp.cta}</Text>
          </View>
        )}

      </Animated.View>
    </Pressable>
  );
});

// ─── Styles ─────────────────────────────────────────────────────────────────────
const ac = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginTop:        24,
    padding:          20,
    borderRadius:     20,
    backgroundColor:  '#FFFFFF',
    // Soft shadow
    shadowColor:      '#000000',
    shadowOffset:     { width: 0, height: 4 },
    shadowOpacity:    0.06,
    shadowRadius:     20,
    elevation:        3,
  },
  title: {
    fontSize:   20,
    fontWeight: '600',
    color:      TEXT_PRIMARY,
    lineHeight: 26,
  },
  subtitle: {
    marginTop:  6,
    fontSize:   14,
    color:      TEXT_MUTED,
    lineHeight: 20,
  },
  cta: {
    marginTop:       16,
    height:          48,
    borderRadius:    14,
    backgroundColor: ACCENT,
    alignItems:      'center',
    justifyContent:  'center',
  },
  ctaLabel: {
    color:      '#FFFFFF',
    fontSize:   16,
    fontWeight: '600',
  },
});
