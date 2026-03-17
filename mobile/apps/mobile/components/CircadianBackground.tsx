/**
 * CircadianBackground — Gradient animé selon l'heure de la journée.
 *
 * Périodes :
 *   Matin    05:00–11:59  bleu nuit → bleu clair + lueur chaude en bas
 *   Après-midi 12:00–16:59  bleu doux → teal/vert subtil
 *   Soir     17:00–20:59  bleu profond → indigo → violet très sombre
 *   Nuit     21:00–04:59  noir → bleu très foncé + étoiles
 */

import { useEffect, useRef, useState, memo } from 'react';
import {
  View,
  Animated,
  StyleSheet,
  Dimensions,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// ─── Palettes ─────────────────────────────────────────────────────────────────

type Period = 'morning' | 'afternoon' | 'evening' | 'night';

const PALETTES: Record<Period, readonly [string, string, string, string]> = {
  morning:   ['#0B1828', '#142d52', '#1e5080', '#c87232'],
  afternoon: ['#081828', '#0d2e50', '#14506e', '#1a7a72'],
  evening:   ['#080820', '#12103a', '#1e0e50', '#2a0a38'],
  night:     ['#02040a', '#050d18', '#080f22', '#0a1530'],
};

const LOCATIONS: [number, number, number, number] = [0, 0.38, 0.72, 1];

function getPeriod(hour: number): Period {
  if (hour >= 5  && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

// ─── Stars (nuit uniquement) ──────────────────────────────────────────────────

const STAR_COUNT = 55;

const STARS = Array.from({ length: STAR_COUNT }, (_, i) => ({
  id:   i,
  top:  Math.random() * 0.65,   // top 65% de l'écran
  left: Math.random(),
  size: Math.random() < 0.15 ? 2 : 1.2,
  delay: Math.random() * 4000,
  duration: 2500 + Math.random() * 2000,
}));

const StarField = memo(function StarField({ opacity }: { opacity: Animated.Value }) {
  const { width, height } = useWindowDimensions();
  const pulses = useRef(STARS.map(() => new Animated.Value(0.4))).current;

  useEffect(() => {
    const anims = pulses.map((p, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(STARS[i].delay),
          Animated.timing(p, { toValue: 1,   duration: STARS[i].duration, useNativeDriver: true }),
          Animated.timing(p, { toValue: 0.3, duration: STARS[i].duration, useNativeDriver: true }),
        ])
      )
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="none">
      {STARS.map((star, i) => (
        <Animated.View
          key={star.id}
          style={{
            position:        'absolute',
            top:             star.top  * height,
            left:            star.left * width,
            width:           star.size,
            height:          star.size,
            borderRadius:    star.size / 2,
            backgroundColor: '#ffffff',
            opacity:         pulses[i],
          }}
        />
      ))}
    </Animated.View>
  );
});

// ─── Main component ────────────────────────────────────────────────────────────

interface Props {
  style?: object;
  children?: React.ReactNode;
}

export function CircadianBackground({ style, children }: Props) {
  const [currentPeriod, setCurrentPeriod] = useState<Period>(() =>
    getPeriod(new Date().getHours())
  );
  const [nextPeriod,    setNextPeriod]    = useState<Period | null>(null);

  // Opacity of the "next" layer — fades in over 2.5s during transition
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const starsAnim  = useRef(new Animated.Value(currentPeriod === 'night' ? 1 : 0)).current;

  // Re-check period every minute
  useEffect(() => {
    const tick = () => {
      const period = getPeriod(new Date().getHours());
      if (period !== currentPeriod) {
        setNextPeriod(period);
        fadeAnim.setValue(0);
        Animated.timing(fadeAnim, {
          toValue:  1,
          duration: 2500,
          useNativeDriver: false, // LinearGradient color changes require JS driver
        }).start(() => {
          setCurrentPeriod(period);
          setNextPeriod(null);
          fadeAnim.setValue(0);
        });
        // Stars fade in/out
        Animated.timing(starsAnim, {
          toValue:  period === 'night' ? 1 : 0,
          duration: 3000,
          useNativeDriver: true,
        }).start();
      }
    };

    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [currentPeriod]);

  const currentColors = PALETTES[currentPeriod];
  const nextColors    = nextPeriod ? PALETTES[nextPeriod] : null;

  return (
    <View style={[StyleSheet.absoluteFill, style]}>
      {/* Layer 1 — current period */}
      <LinearGradient
        colors={[...currentColors]}
        locations={LOCATIONS}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Layer 2 — next period (fades in during transition) */}
      {nextColors && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
          <LinearGradient
            colors={[...nextColors]}
            locations={LOCATIONS}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          />
        </Animated.View>
      )}

      {/* Stars — nuit uniquement */}
      <StarField opacity={starsAnim} />

      {children}
    </View>
  );
}
