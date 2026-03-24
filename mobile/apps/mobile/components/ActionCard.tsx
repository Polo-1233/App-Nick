/**
 * ActionCard — CTA unique context-driven
 *
 * Un seul état à la fois. Piloté par dayPlan.nextAction.
 * Logique contextuelle : MRM / CRP / wind-down / missed cycle / goodnight.
 */

import { useRef, memo } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NextAction } from '@r90/types';
import { type MissedCycleInfo } from '../lib/missed-cycle';
import { nowMin } from '../lib/time-utils';

export type { MissedCycleInfo };

const CARD    = '#141466';
const ACCENT  = '#1c9fda';
const GOLD    = '#F5A623';
const TEXT    = '#FFFFFF';
const SUB     = '#A8C4E0';
const MUTED   = '#6B8CAE';

interface ActionCardProps {
  action:          NextAction | null;
  missedCycle?:    MissedCycleInfo | null;
  onPress:         () => void;
  showButton?:     boolean;
}

interface ActionDisplay {
  title:      string;
  subtitle:   string;
  icon:       string;
  iconColor:  string;
  urgent:     boolean;
  showButton: boolean;
  buttonLabel?: string;
}

function buildDisplay(
  action: NextAction | null,
  nowMin: number,
  missedCycle?: MissedCycleInfo | null,
): ActionDisplay {
  // Missed cycle takes priority
  if (missedCycle?.missed) {
    return {
      title:      'Next window',
      subtitle:   `${missedCycle.nextWindow} — ${missedCycle.cyclesRemaining} cycles — still a great night.`,
      icon:       'moon-outline',
      iconColor:  ACCENT,
      urgent:     false,
      showButton: false,
    };
  }

  if (!action) {
    return {
      title:      'Your rhythm is on track',
      subtitle:   'Good night.',
      icon:       'checkmark-circle-outline',
      iconColor:  ACCENT,
      urgent:     false,
      showButton: false,
    };
  }

  const at   = action.scheduledAt;
  const diff = at !== undefined ? at - nowMin : null;
  const diffStr = diff !== null && diff > 0 ? ` dans ${diff} min` : '';

  switch (action.type) {
    case 'wake_up':
      return {
        title:       'Confirm your wake-up',
        subtitle:    action.description || 'Tap to confirm (+5)',
        icon:        'sunny-outline',
        iconColor:   GOLD,
        urgent:      false,
        showButton:  true,
        buttonLabel: 'Confirm (+5)',
      };

    case 'take_crp':
      return {
        title:       action.title,
        subtitle:    `CRP${diffStr} — 20 min recovery`,
        icon:        'flash-outline',
        iconColor:   GOLD,
        urgent:      diff !== null && diff < 15,
        showButton:  true,
        buttonLabel: 'Start →',
      };

    case 'crp_reminder':
      return {
        title:       'Recovery now',
        subtitle:    '20 min — window open',
        icon:        'flash',
        iconColor:   GOLD,
        urgent:      true,
        showButton:  true,
        buttonLabel: 'Start →',
      };

    case 'start_pre_sleep':
      return {
        title:       action.title,
        subtitle:    `Wind-down${diffStr}`,
        icon:        'moon-outline',
        iconColor:   ACCENT,
        urgent:      diff !== null && diff < 30,
        showButton:  diff !== null && diff <= 0,
        buttonLabel: 'Start →',
      };

    case 'go_to_sleep':
      return {
        title:       'Sleep window open',
        subtitle:    action.description || 'Good night.',
        icon:        'bed-outline',
        iconColor:   ACCENT,
        urgent:      true,
        showButton:  false,
      };

    case 'anchor_reminder':
      return {
        title:       action.title,
        subtitle:    action.description,
        icon:        'alarm-outline',
        iconColor:   ACCENT,
        urgent:      false,
        showButton:  false,
      };

    default:
      return {
        title:       action.title,
        subtitle:    action.description,
        icon:        'navigate-circle-outline',
        iconColor:   ACCENT,
        urgent:      false,
        showButton:  false,
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

  return (
    <Pressable onPress={handlePress} accessible accessibilityRole="button" accessibilityLabel={disp.title}>
      <Animated.View style={[
        ac.card,
        disp.urgent && ac.urgent,
        { transform: [{ scale }] },
      ]}>
        <View style={[ac.iconWrap, { backgroundColor: `${disp.iconColor}18` }]}>
          <Ionicons name={disp.icon as any} size={24} color={disp.iconColor} />
        </View>

        <View style={ac.body}>
          <Text style={ac.title} numberOfLines={1}>{disp.title}</Text>
          <Text style={ac.subtitle} numberOfLines={2}>{disp.subtitle}</Text>
        </View>

        {(showButton !== false && disp.showButton && disp.buttonLabel) ? (
          <View style={[ac.btn, { backgroundColor: `${disp.iconColor}22`, borderColor: `${disp.iconColor}40` }]}>
            <Text style={[ac.btnLabel, { color: disp.iconColor }]}>{disp.buttonLabel}</Text>
          </View>
        ) : (
          <Ionicons name="chevron-forward" size={16} color={MUTED} />
        )}
      </Animated.View>
    </Pressable>
  );
});

const ac = StyleSheet.create({
  card:     { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: CARD, borderRadius: 18, padding: 18, marginHorizontal: 20, marginTop: 16, borderWidth: 1, borderColor: `${ACCENT}25` },
  urgent:   { borderColor: `${GOLD}40`, backgroundColor: 'rgba(245,166,35,0.06)' },
  iconWrap: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  body:     { flex: 1, gap: 4 },
  title:    { fontSize: 15, fontWeight: '700', color: TEXT },
  subtitle: { fontSize: 13, color: SUB, lineHeight: 18 },
  btn:      { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  btnLabel: { fontSize: 12, fontWeight: '700' },
});
