/**
 * ActionCard — Spec pixel-perfect R90
 *
 * - Carte blanche, shadow légère
 * - Titre 20px / 600, texte #002060
 * - Sous-texte 14px, couleur #6B7A90
 * - Bouton CTA plein bleu 48px, 1 seul
 * - Micro scale au tap (0.97 → 1)
 */

import { useRef, memo } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import type { NextAction } from '@r90/types';
import { type MissedCycleInfo } from '../lib/missed-cycle';
import { nowMin } from '../lib/time-utils';

export type { MissedCycleInfo };

// Design tokens — fixed by spec
const TEXT_PRIMARY = '#002060';
const TEXT_SUB     = '#6B7A90';
const ACCENT       = '#1c9fda';
const GOLD         = '#F5A623';

interface ActionCardProps {
  action:      NextAction | null;
  missedCycle?: MissedCycleInfo | null;
  onPress:     () => void;
  showButton?: boolean;
}

interface ActionDisplay {
  title:        string;
  subtitle:     string;
  ctaLabel:     string | null;   // null = pas de bouton
  urgent:       boolean;
}

function buildDisplay(
  action:      NextAction | null,
  now:         number,
  missedCycle?: MissedCycleInfo | null,
): ActionDisplay {

  if (missedCycle?.missed) {
    return {
      title:    `Next window: ${missedCycle.nextWindow}`,
      subtitle: `${missedCycle.cyclesRemaining} cycles — still a great night.`,
      ctaLabel: null,
      urgent:   false,
    };
  }

  if (!action) {
    return {
      title:    'Your rhythm is on track',
      subtitle: 'Rest well.',
      ctaLabel: null,
      urgent:   false,
    };
  }

  const at   = action.scheduledAt;
  const diff = at !== undefined ? at - now : null;
  const inMin = diff !== null && diff > 0 ? ` in ${diff} min` : '';

  switch (action.type) {
    case 'wake_up':
      return {
        title:    'Confirm your wake-up',
        subtitle: 'Log your night to track your rhythm.',
        ctaLabel: 'Confirm (+5)',
        urgent:   false,
      };

    case 'take_mrm':
    case 'mrm_reminder':
      return {
        title:    `Reset${inMin}`,
        subtitle: '2-minute breathing break.',
        ctaLabel: 'Start',
        urgent:   diff !== null && diff <= 5,
      };

    case 'take_crp':
      return {
        title:    `Recovery${inMin}`,
        subtitle: '20-min CRP — window open.',
        ctaLabel: 'Start',
        urgent:   diff !== null && diff < 15,
      };

    case 'crp_reminder':
      return {
        title:    'Recovery now',
        subtitle: '20 min — window open.',
        ctaLabel: 'Start',
        urgent:   true,
      };

    case 'start_pre_sleep':
      return {
        title:    `Wind-down${inMin}`,
        subtitle: 'Start stepping away from screens.',
        ctaLabel: diff !== null && diff <= 0 ? 'Start' : null,
        urgent:   diff !== null && diff < 30,
      };

    case 'go_to_sleep':
      return {
        title:    'Sleep window open',
        subtitle: action.description || 'Good night.',
        ctaLabel: null,
        urgent:   true,
      };

    case 'anchor_reminder':
      return {
        title:    action.title,
        subtitle: action.description,
        ctaLabel: null,
        urgent:   false,
      };

    default:
      return {
        title:    action.title,
        subtitle: action.description,
        ctaLabel: null,
        urgent:   false,
      };
  }
}

export const ActionCard = memo(function ActionCard({
  action, missedCycle, onPress, showButton,
}: ActionCardProps) {
  const now  = nowMin();
  const disp = buildDisplay(action, now, missedCycle);
  const scale = useRef(new Animated.Value(1)).current;

  function handlePress() {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.97, duration: 80,  useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1.00, duration: 120, useNativeDriver: true }),
    ]).start(() => onPress());
  }

  const showCTA = showButton !== false && disp.ctaLabel !== null;

  return (
    <Pressable onPress={handlePress} accessible accessibilityRole="button" accessibilityLabel={disp.title}>
      <Animated.View style={[ac.card, { transform: [{ scale }] }]}>
        <Text style={ac.title}>{disp.title}</Text>
        {!!disp.subtitle && (
          <Text style={ac.subtitle}>{disp.subtitle}</Text>
        )}
        {showCTA && (
          <View style={[ac.cta, disp.urgent && { backgroundColor: GOLD }]}>
            <Text style={ac.ctaLabel}>{disp.ctaLabel}</Text>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
});

const ac = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginTop:        24,
    padding:          20,
    borderRadius:     20,
    backgroundColor:  '#FFFFFF',
    shadowColor:      '#000000',
    shadowOffset:     { width: 1, height: 8 },
    shadowOpacity:    0.06,
    shadowRadius:     30,
    elevation:        4,
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
    color:      TEXT_SUB,
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
