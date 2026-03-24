/**
 * ActionCard — Live R90 Action Coach
 *
 * Consomme getCurrentActionState() — se met à jour chaque minute.
 * Toujours actionnable. Jamais passif.
 *
 * Layout vertical :
 *   [Badge état]
 *   [Titre — 22px gras]
 *   [Sous-titre]
 *   [Bouton CTA pleine largeur]  ← uniquement si action disponible
 */

import { useState, useEffect, useRef, memo } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { nowMin } from '../../lib/time-utils';
import { getCurrentActionState, type ActionCardState } from '../../lib/action-state';

// ─── Tokens ──────────────────────────────────────────────────────────────────
const DEEP   = '#141466';
const ACCENT = '#1c9fda';
const GOLD   = '#F5A623';
const GREEN  = '#22C55E';
const WHITE  = '#FFFFFF';

// ─── Icon per state ───────────────────────────────────────────────────────────
const STATE_ICON: Record<string, string> = {
  morning:      'sunny-outline',
  pre_mrm:      'flash-outline',
  mrm_active:   'flash',
  post_mrm:     'checkmark-circle-outline',
  pre_crp:      'battery-half-outline',
  crp_active:   'battery-charging-outline',
  pre_winddown: 'moon-outline',
  winddown:     'moon',
  sleep_window: 'bed-outline',
  missed_sleep: 'time-outline',
  night:        'star-outline',
  on_track:     'checkmark-circle-outline',
};

// ─── Props ────────────────────────────────────────────────────────────────────
interface ActionCardProps {
  wakeMin:     number;   // ARP in minutes since midnight
  idealCycles: number;
  onPress:     (state: ActionCardState) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export const ActionCard = memo(function ActionCard({
  wakeMin, idealCycles, onPress,
}: ActionCardProps) {
  const [cardState, setCardState] = useState<ActionCardState>(() =>
    getCurrentActionState(nowMin(), wakeMin, idealCycles)
  );

  // ── Real-time update: every 30 seconds ────────────────────────────────────
  useEffect(() => {
    const update = () => {
      const s = getCurrentActionState(nowMin(), wakeMin, idealCycles);
      setCardState(s);
    };
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [wakeMin, idealCycles]);

  // ── Press animation ───────────────────────────────────────────────────────
  const scale = useRef(new Animated.Value(1)).current;

  function handlePress() {
    if (!cardState.cta) return;
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.97, duration: 80,  useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1.00, duration: 120, useNativeDriver: true }),
    ]).start(() => onPress(cardState));
  }

  // ── CTA button pulse when urgent ─────────────────────────────────────────
  const ctaScale = useRef(new Animated.Value(1)).current;
  const urgent   = cardState.state === 'mrm_active' || cardState.state === 'crp_active' || cardState.state === 'sleep_window';

  useEffect(() => {
    if (!urgent) { ctaScale.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ctaScale, { toValue: 1.03, duration: 600, useNativeDriver: true }),
        Animated.timing(ctaScale, { toValue: 1.00, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [urgent]);

  // ── Colors ────────────────────────────────────────────────────────────────
  const ctaColor = cardState.ctaColor === 'gold' ? GOLD : cardState.ctaColor === 'green' ? GREEN : ACCENT;
  const icon     = STATE_ICON[cardState.state] ?? 'navigate-circle-outline';

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={cardState.title}
      disabled={!cardState.cta}
    >
      <Animated.View style={[ac.card, { transform: [{ scale }] }]}>

        {/* State badge */}
        <View style={[ac.badge, { backgroundColor: `${ctaColor}20` }]}>
          <Ionicons name={icon as any} size={13} color={ctaColor} />
          <Text style={[ac.badgeTxt, { color: ctaColor }]}>
            {cardState.state.replace(/_/g, ' ').toUpperCase()}
          </Text>
          {/* Countdown if available */}
          {cardState.nextEventIn !== null && cardState.nextEventIn > 0 && cardState.nextEventIn < 120 && (
            <Text style={[ac.countdown, { color: ctaColor }]}>
              · {cardState.nextEventIn} min
            </Text>
          )}
        </View>

        {/* Main title */}
        <Text style={ac.title}>{cardState.title}</Text>

        {/* Subtitle */}
        {!!cardState.subtitle && (
          <Text style={ac.subtitle}>{cardState.subtitle}</Text>
        )}

        {/* CTA button — full width, animated pulse if urgent */}
        {cardState.cta !== null && (
          <Animated.View style={{ transform: [{ scale: ctaScale }] }}>
            <View style={[ac.cta, { backgroundColor: ctaColor }]}>
              <Text style={ac.ctaTxt}>{cardState.cta}</Text>
            </View>
          </Animated.View>
        )}

      </Animated.View>
    </Pressable>
  );
});

// ─── Styles ──────────────────────────────────────────────────────────────────
const ac = StyleSheet.create({
  card: {
    marginHorizontal:  20,
    marginTop:         20,
    paddingVertical:   24,
    paddingHorizontal: 22,
    borderRadius:      24,
    backgroundColor:   DEEP,
    gap:               10,
    shadowColor:       DEEP,
    shadowOffset:      { width: 0, height: 8 },
    shadowOpacity:     0.22,
    shadowRadius:      24,
    elevation:         6,
  },
  badge: {
    flexDirection:     'row',
    alignItems:        'center',
    alignSelf:         'flex-start',
    gap:               5,
    borderRadius:      20,
    paddingHorizontal: 10,
    paddingVertical:   5,
  },
  badgeTxt: {
    fontSize:      11,
    fontWeight:    '700',
    letterSpacing: 0.5,
  },
  countdown: {
    fontSize:   11,
    fontWeight: '700',
  },
  title: {
    fontSize:      22,
    fontWeight:    '700',
    color:         WHITE,
    lineHeight:    28,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize:  14,
    color:     'rgba(255,255,255,0.65)',
    lineHeight: 20,
  },
  cta: {
    marginTop:      8,
    height:         50,
    borderRadius:   16,
    alignItems:     'center',
    justifyContent: 'center',
  },
  ctaTxt: {
    fontSize:      16,
    fontWeight:    '700',
    color:         WHITE,
    letterSpacing: 0.2,
  },
});
