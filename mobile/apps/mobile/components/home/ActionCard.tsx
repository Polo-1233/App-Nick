/**
 * ActionCard — Élément dominant de la HomeScreen
 *
 * Layout vertical :
 *   [Icône + badge état]
 *   [Titre — grand, gras]
 *   [Sous-titre — contexte]
 *   [Bouton CTA pleine largeur]
 *
 * Règles :
 *   - Titre dynamique : "Reset dans 12 min" / "Wind-down dans 45 min" / "Confirme ton réveil"
 *   - 1 seul CTA : "Commencer" / "Se préparer" / "Confirmer"
 *   - Toujours déclencher une action
 *   - Scale 0.97 → 1 au tap
 */

import { useRef, memo } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NextAction } from '@r90/types';
import { nowMin } from '../../lib/time-utils';
import type { MissedCycleInfo } from '../../lib/missed-cycle';

// ─── Tokens ──────────────────────────────────────────────────────────────────
const DEEP   = '#141466';
const ACCENT = '#1c9fda';
const GOLD   = '#F5A623';
const GREEN  = '#22C55E';
const WHITE  = '#FFFFFF';

// ─── Types ───────────────────────────────────────────────────────────────────
interface ActionCardProps {
  action:       NextAction | null;
  missedCycle?: MissedCycleInfo | null;
  onPress:      () => void;
}

interface Display {
  icon:      string;
  accentColor: string;
  label:     string;   // pill au-dessus du titre (ex: "RESET · 12 MIN")
  title:     string;   // titre principal
  subtitle:  string;   // sous-texte
  cta:       string | null;
}

// ─── Contenu dynamique ───────────────────────────────────────────────────────
function build(
  action:      NextAction | null,
  now:         number,
  missedCycle?: MissedCycleInfo | null,
): Display {

  if (missedCycle?.missed) {
    return {
      icon: 'moon-outline', accentColor: ACCENT,
      label:    'MISSED WINDOW',
      title:    `Next window at ${missedCycle.nextWindow}`,
      subtitle: `${missedCycle.cyclesRemaining} cycles available — still a great night.`,
      cta:      null,
    };
  }

  if (!action) {
    return {
      icon: 'checkmark-circle-outline', accentColor: GREEN,
      label:    'ON TRACK',
      title:    'Your rhythm is on track',
      subtitle: 'Stay consistent and rest well tonight.',
      cta:      null,
    };
  }

  const diff   = action.scheduledAt !== undefined ? action.scheduledAt - now : null;
  const mins   = diff !== null && diff > 0 ? diff : 0;
  const urgent = diff !== null && diff <= 5;

  switch (action.type) {
    case 'wake_up':
      return {
        icon: 'sunny-outline', accentColor: GOLD,
        label:   'WAKE-UP',
        title:   'Confirm your wake-up',
        subtitle: 'Log your night to keep your weekly tracking accurate.',
        cta:     'Confirm (+5)',
      };

    case 'take_mrm':
    case 'mrm_reminder':
      return {
        icon: 'flash-outline', accentColor: ACCENT,
        label:   urgent ? 'RESET · NOW' : `RESET · ${mins} MIN`,
        title:   urgent ? 'Reset time' : `Reset in ${mins} min`,
        subtitle: '2-minute breathing break to clear your mind.',
        cta:     'Start',
      };

    case 'take_crp':
      return {
        icon: 'flash', accentColor: GOLD,
        label:   urgent ? 'RECOVERY · NOW' : `RECOVERY · ${mins} MIN`,
        title:   urgent ? 'Recovery time' : `Recovery in ${mins} min`,
        subtitle: '20-min CRP — essential for your performance today.',
        cta:     'Start',
      };

    case 'crp_reminder':
      return {
        icon: 'flash', accentColor: GOLD,
        label:   'RECOVERY · OPEN',
        title:   'Recovery window open',
        subtitle: '20 minutes. Your body will thank you.',
        cta:     'Start',
      };

    case 'start_pre_sleep':
      return {
        icon: 'moon-outline', accentColor: ACCENT,
        label:   mins > 0 ? `WIND-DOWN · ${mins} MIN` : 'WIND-DOWN · NOW',
        title:   mins > 0 ? `Wind-down in ${mins} min` : 'Wind-down time',
        subtitle: 'Start stepping away from screens. Prepare your mind.',
        cta:     mins <= 0 ? 'Get ready' : null,
      };

    case 'go_to_sleep':
      return {
        icon: 'bed-outline', accentColor: ACCENT,
        label:   'SLEEP WINDOW · OPEN',
        title:   'Time to sleep',
        subtitle: 'Your sleep window is open. Your body is ready.',
        cta:     'Start wind-down',
      };

    case 'anchor_reminder':
      return {
        icon: 'alarm-outline', accentColor: ACCENT,
        label:   'ANCHOR TIME',
        title:   action.title,
        subtitle: action.description ?? '',
        cta:     null,
      };

    default:
      return {
        icon: 'navigate-circle-outline', accentColor: ACCENT,
        label:   'NEXT',
        title:   action.title,
        subtitle: action.description ?? '',
        cta:     null,
      };
  }
}

// ─── Component ───────────────────────────────────────────────────────────────
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

        {/* State badge */}
        <View style={[ac.badge, { backgroundColor: `${disp.accentColor}22` }]}>
          <Ionicons name={disp.icon as any} size={13} color={disp.accentColor} />
          <Text style={[ac.badgeTxt, { color: disp.accentColor }]}>{disp.label}</Text>
        </View>

        {/* Main title */}
        <Text style={ac.title}>{disp.title}</Text>

        {/* Subtitle */}
        {!!disp.subtitle && (
          <Text style={ac.subtitle}>{disp.subtitle}</Text>
        )}

        {/* CTA — full width */}
        {disp.cta !== null && (
          <Pressable onPress={handlePress} style={[ac.cta, { backgroundColor: disp.accentColor }]}>
            <Text style={ac.ctaTxt}>{disp.cta}</Text>
          </Pressable>
        )}

      </Animated.View>
    </Pressable>
  );
});

// ─── Styles ──────────────────────────────────────────────────────────────────
const ac = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginTop:        20,
    paddingVertical:  24,
    paddingHorizontal: 22,
    borderRadius:     24,
    backgroundColor:  DEEP,
    gap:              10,
    shadowColor:      DEEP,
    shadowOffset:     { width: 0, height: 8 },
    shadowOpacity:    0.20,
    shadowRadius:     24,
    elevation:        6,
  },
  badge: {
    flexDirection:   'row',
    alignItems:      'center',
    alignSelf:       'flex-start',
    gap:             5,
    borderRadius:    20,
    paddingHorizontal: 10,
    paddingVertical:    5,
  },
  badgeTxt: {
    fontSize:   11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  title: {
    fontSize:   22,
    fontWeight: '700',
    color:      WHITE,
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize:  14,
    color:     'rgba(255,255,255,0.65)',
    lineHeight: 20,
  },
  cta: {
    marginTop:    8,
    height:       50,
    borderRadius: 16,
    alignItems:   'center',
    justifyContent: 'center',
  },
  ctaTxt: {
    fontSize:   16,
    fontWeight: '700',
    color:      WHITE,
    letterSpacing: 0.2,
  },
});
