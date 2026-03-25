/**
 * RhythmDepthCard — Premium Rhythm Progression Card
 *
 * Shows the user's rhythm depth as a warm, motivating, premium card.
 *
 * 3 zones:
 *   1. Current level — name + tagline + ring progress
 *   2. What's next — next unlock teaser
 *   3. Tap → full Rhythm Journey modal
 *
 * States:
 *   - New user (Aware, 0 signal) → "Building your rhythm" — encouraging, not empty
 *   - Progressing (Attuned/Calibrated) → shows real progress + next unlock
 *   - Advanced (Embodied/Integrated) → "Your rhythm is deep" — celebration
 *
 * Philosophy: quiet mastery, not gamer XP.
 */

import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal,
  Animated, ScrollView, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../lib/theme-context';
import {
  getDepth, getProgressToNext, DEPTH_LEVELS,
  getUnlockedContent,
  type RhythmDepthState,
} from '../lib/rhythm-depth';

// ─── Tokens (always dark — this card is dark-only) ──────────────────────────
const CARD_BG = '#141466';
const SURFACE = '#1c1c7a';
const TEXT_W  = '#FFFFFF';
const TEXT_M  = '#A8C4E0';
const TEXT_F  = '#6B8CAE';
const BORDER  = 'rgba(28,159,218,0.10)';
const ACCENT  = '#1c9fda';

const { width: SW } = Dimensions.get('window');

// ─── Circular progress ring ─────────────────────────────────────────────────

const RING_SIZE = 64;
const RING_STROKE = 4;
const RING_R = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUM = 2 * Math.PI * RING_R;

/**
 * A segmented circular ring built with Views.
 * Shows progress as a colored arc around a center icon.
 * No SVG needed — uses a rotated half-circle mask technique.
 */
function ProgressRing({ pct, color, children }: {
  pct: number;
  color: string;
  children: React.ReactNode;
}) {
  // Animate the progress value
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: pct, duration: 1000, useNativeDriver: false }).start();
  }, [pct]);

  // For simplicity in RN (no SVG), we use a solid ring with overlay masks
  // The "filled" portion is approximated by rotating a half-circle
  return (
    <View style={ring.wrap}>
      {/* Background ring */}
      <View style={[ring.bgRing, { borderColor: `${color}18` }]} />

      {/* Progress arc — built with two halves */}
      {pct > 0 && (
        <>
          {/* Right half (0–50%) */}
          <View style={ring.halfWrap}>
            <Animated.View style={[ring.half, {
              borderColor: color,
              transform: [{
                rotate: anim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: ['0deg', '180deg', '180deg'],
                  extrapolate: 'clamp',
                }),
              }],
            }]} />
          </View>

          {/* Left half (50–100%) */}
          {pct > 0.5 && (
            <View style={[ring.halfWrap, { transform: [{ scaleX: -1 }] }]}>
              <Animated.View style={[ring.half, {
                borderColor: color,
                transform: [{
                  rotate: anim.interpolate({
                    inputRange: [0.5, 1],
                    outputRange: ['0deg', '180deg'],
                    extrapolate: 'clamp',
                  }),
                }],
              }]} />
            </View>
          )}

          {/* Mask to hide overflow on left half when < 50% */}
          {pct <= 0.5 && (
            <View style={[ring.maskHalf, { backgroundColor: CARD_BG }]} />
          )}
        </>
      )}

      {/* Center content */}
      <View style={ring.center}>
        {children}
      </View>
    </View>
  );
}

const ring = StyleSheet.create({
  wrap: {
    width: RING_SIZE, height: RING_SIZE,
    alignItems: 'center', justifyContent: 'center',
  },
  bgRing: {
    position: 'absolute',
    width: RING_SIZE, height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: RING_STROKE,
  },
  halfWrap: {
    position: 'absolute',
    width: RING_SIZE / 2, height: RING_SIZE,
    left: RING_SIZE / 2,
    overflow: 'hidden',
  },
  half: {
    width: RING_SIZE, height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: RING_STROKE,
    borderColor: 'transparent',
    borderTopColor: 'inherit',
    borderRightColor: 'inherit',
    position: 'absolute',
    right: 0,
  },
  maskHalf: {
    position: 'absolute',
    width: RING_SIZE / 2, height: RING_SIZE,
    left: 0,
  },
  center: {
    alignItems: 'center', justifyContent: 'center',
  },
});

// ─── Unlock icon helper ─────────────────────────────────────────────────────
function unlockIcon(type: string): keyof typeof Ionicons.glyphMap {
  if (type === 'insight') return 'bulb-outline';
  if (type === 'feature') return 'sparkles-outline';
  return 'headset-outline';
}

// ─── Journey modal (kept, polished) ─────────────────────────────────────────

function JourneyModal({ visible, onClose, state }: {
  visible: boolean; onClose: () => void; state: RhythmDepthState;
}) {
  const { level: currentLevel } = getProgressToNext(state.signal);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={jm.root}>
        <View style={jm.header}>
          <Text style={jm.title}>Rhythm Journey</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={22} color={TEXT_F} />
          </Pressable>
        </View>

        <View style={jm.explainer}>
          <Ionicons name="information-circle-outline" size={15} color={ACCENT} />
          <Text style={jm.explainerTxt}>
            Your rhythm deepens as you confirm your wake time, complete MRMs, CRPs and wind-downs.
            Each level unlocks real coaching content from Nick Littlehales.
          </Text>
        </View>

        <ScrollView contentContainerStyle={jm.scroll} showsVerticalScrollIndicator={false}>
          {DEPTH_LEVELS.map((lvl, i) => {
            const isReached = state.signal >= lvl.minSignal;
            const isCurrent = lvl.id === currentLevel.id;
            const { pct }   = isCurrent ? getProgressToNext(state.signal) : { pct: isReached ? 1 : 0 };
            const nextLvl   = DEPTH_LEVELS[i + 1];
            const isNext    = i === DEPTH_LEVELS.indexOf(currentLevel) + 1;

            return (
              <View key={lvl.id} style={[jm.levelBlock, isCurrent && { borderColor: `${lvl.color}40`, borderWidth: 1.5 }]}>
                <View style={jm.levelRow}>
                  <View style={[jm.levelDot, { backgroundColor: isReached ? lvl.color : 'rgba(255,255,255,0.10)' }]}>
                    {isReached && !isCurrent && <Ionicons name="checkmark" size={10} color="#000" />}
                    {isCurrent && <View style={[jm.innerDot, { backgroundColor: lvl.color }]} />}
                  </View>
                  <Text style={[jm.levelName, { color: isReached ? lvl.color : TEXT_F }]}>{lvl.label}</Text>
                  {isCurrent && (
                    <View style={[jm.nowBadge, { borderColor: lvl.color }]}>
                      <Text style={[jm.nowTxt, { color: lvl.color }]}>YOU ARE HERE</Text>
                    </View>
                  )}
                </View>

                <Text style={[jm.tagline, { color: isCurrent ? TEXT_M : TEXT_F }]}>{lvl.tagline}</Text>

                {isCurrent && nextLvl && (
                  <View style={jm.barRow}>
                    <DepthBar pct={pct} color={lvl.color} />
                    <Text style={jm.nextLvlHint}>→ {nextLvl.label}</Text>
                  </View>
                )}

                <View style={jm.unlockList}>
                  {lvl.unlocks.map(u => (
                    <View key={u.id} style={jm.unlockRow}>
                      <View style={[jm.unlockIconWrap, {
                        backgroundColor: isReached ? `${lvl.color}20` : 'rgba(255,255,255,0.05)',
                      }]}>
                        <Ionicons
                          name={isReached ? unlockIcon(u.type) : 'lock-closed-outline'}
                          size={12}
                          color={isReached ? lvl.color : TEXT_F}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[jm.unlockTitle, { color: isReached ? TEXT_W : TEXT_F }]}>{u.title}</Text>
                        {(isReached || isNext) && (
                          <Text style={jm.unlockDesc}>{u.description}</Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// Simple animated bar for journey modal
function DepthBar({ pct, color }: { pct: number; color: string }) {
  const width = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(width, { toValue: pct, duration: 900, useNativeDriver: false }).start();
  }, [pct]);
  return (
    <View style={{ height: 5, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
      <Animated.View style={{
        height: 5, borderRadius: 3, backgroundColor: color,
        width: width.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
      }} />
    </View>
  );
}

const jm = StyleSheet.create({
  root:          { flex: 1, backgroundColor: '#0a0a3a' },
  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  title:         { fontSize: 18, fontWeight: '700', color: TEXT_W },
  explainer:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginHorizontal: 20, marginBottom: 16, backgroundColor: `${ACCENT}12`, padding: 12, borderRadius: 12 },
  explainerTxt:  { flex: 1, fontSize: 12, color: TEXT_M, lineHeight: 18 },
  scroll:        { paddingHorizontal: 20, gap: 12 },
  levelBlock:    { backgroundColor: CARD_BG, borderRadius: 16, padding: 16, gap: 10, borderWidth: 1, borderColor: BORDER },
  levelRow:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  levelDot:      { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  innerDot:      { width: 8, height: 8, borderRadius: 4 },
  levelName:     { fontSize: 15, fontWeight: '800', flex: 1 },
  nowBadge:      { borderWidth: 1, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  nowTxt:        { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  tagline:       { fontSize: 12, lineHeight: 17, paddingLeft: 32 },
  barRow:        { paddingLeft: 32, gap: 4 },
  nextLvlHint:   { fontSize: 10, color: TEXT_F, textAlign: 'right' },
  unlockList:    { gap: 8, paddingLeft: 12 },
  unlockRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  unlockIconWrap:{ width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  unlockTitle:   { fontSize: 12, fontWeight: '600', lineHeight: 17 },
  unlockDesc:    { fontSize: 11, color: TEXT_F, lineHeight: 16, marginTop: 1 },
});

// ─── Main card ────────────────────────────────────────────────────────────────

export function RhythmDepthCard() {
  const [state,       setState]       = useState<RhythmDepthState | null>(null);
  const [showJourney, setShowJourney] = useState(false);

  // Subtle glow pulse on the level color
  const glowAnim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 0.8, duration: 2000, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 2000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [glowAnim]);

  useEffect(() => { getDepth().then(setState).catch(() => {}); }, []);

  if (!state) return null;

  const { level, next, pct } = getProgressToNext(state.signal);
  const isNew      = state.signal === 0;
  const isMax      = !next;
  const daysActive = state.totalDaysActive;

  // Next unlock — the first unlock of the next level
  const nextUnlock = next?.unlocks?.[0];

  // Contextual tagline — adapts to state
  const tagline = isNew
    ? 'Your rhythm journey begins here.'
    : isMax
      ? 'Your rhythm runs deep.'
      : level.tagline;

  // Progress label
  const progressLabel = isMax
    ? 'Fully integrated'
    : next
      ? `${Math.round(pct * 100)}% to ${next.label}`
      : '';

  return (
    <>
      <Pressable
        onPress={() => setShowJourney(true)}
        style={({ pressed }) => [rc.card, pressed && { opacity: 0.88, transform: [{ scale: 0.985 }] }]}
      >
        {/* Subtle glow behind the ring */}
        <Animated.View style={[rc.glow, {
          backgroundColor: level.color,
          opacity: glowAnim.interpolate({ inputRange: [0.4, 0.8], outputRange: [0.04, 0.10] }),
        }]} />

        {/* Top section: ring + level info */}
        <View style={rc.topRow}>
          {/* Progress ring with level initial */}
          <View style={rc.ringArea}>
            <ProgressRing pct={pct} color={level.color}>
              <Text style={[rc.ringLetter, { color: level.color }]}>
                {level.label.charAt(0)}
              </Text>
            </ProgressRing>
          </View>

          {/* Level name + tagline */}
          <View style={rc.infoArea}>
            <View style={rc.levelRow}>
              <Text style={[rc.levelName, { color: level.color }]}>{level.label}</Text>
              {daysActive > 0 && (
                <Text style={rc.daysLabel}>{daysActive} day{daysActive > 1 ? 's' : ''}</Text>
              )}
            </View>
            <Text style={rc.tagline}>{tagline}</Text>

            {/* Progress bar + label */}
            {!isMax && next && (
              <View style={rc.progressArea}>
                <View style={rc.barBg}>
                  <View style={[rc.barFill, {
                    width: `${Math.max(3, pct * 100)}%` as any,
                    backgroundColor: level.color,
                  }]} />
                </View>
                <Text style={rc.progressLabel}>{progressLabel}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Next unlock teaser */}
        {nextUnlock && (
          <View style={rc.nextRow}>
            <View style={[rc.nextIconWrap, { backgroundColor: `${next!.color}18` }]}>
              <Ionicons name={unlockIcon(nextUnlock.type)} size={12} color={next!.color} />
            </View>
            <View style={rc.nextTextArea}>
              <Text style={rc.nextPrefix}>Next unlock</Text>
              <Text style={rc.nextTitle} numberOfLines={1}>{nextUnlock.title}</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={TEXT_F} />
          </View>
        )}

        {/* Max level — celebration instead of next unlock */}
        {isMax && (
          <View style={rc.maxRow}>
            <Ionicons name="sparkles" size={14} color={level.color} />
            <Text style={[rc.maxText, { color: level.color }]}>All content unlocked</Text>
          </View>
        )}

      </Pressable>

      <JourneyModal
        visible={showJourney}
        onClose={() => setShowJourney(false)}
        state={state}
      />
    </>
  );
}

// ─── Card styles ──────────────────────────────────────────────────────────────

const rc = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    borderRadius:    20,
    padding:         18,
    borderWidth:     1,
    borderColor:     BORDER,
    overflow:        'hidden',
    gap:             14,
  },

  // Glow — subtle ambient behind ring
  glow: {
    position: 'absolute',
    top:      -20,
    left:     -10,
    width:    100,
    height:   100,
    borderRadius: 50,
  },

  // Top section
  topRow: {
    flexDirection: 'row',
    gap:           16,
  },
  ringArea: {
    flexShrink: 0,
  },
  infoArea: {
    flex: 1,
    gap:  6,
    justifyContent: 'center',
  },
  levelRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  levelName: {
    fontSize:      18,
    fontWeight:    '800',
    letterSpacing: -0.3,
  },
  daysLabel: {
    fontSize:   11,
    fontWeight: '600',
    color:      TEXT_F,
  },
  tagline: {
    fontSize:   13,
    fontWeight: '400',
    color:      TEXT_M,
    lineHeight: 18,
  },

  // Ring center letter
  ringLetter: {
    fontSize:      22,
    fontWeight:    '800',
    letterSpacing: -0.5,
  },

  // Progress bar
  progressArea: {
    gap:      4,
    marginTop: 2,
  },
  barBg: {
    height:          4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius:    2,
    overflow:        'hidden',
  },
  barFill: {
    height:       4,
    borderRadius: 2,
  },
  progressLabel: {
    fontSize:   10,
    fontWeight: '600',
    color:      TEXT_F,
  },

  // Next unlock row
  nextRow: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             10,
    backgroundColor: SURFACE,
    borderRadius:    12,
    padding:         12,
  },
  nextIconWrap: {
    width:        28,
    height:       28,
    borderRadius: 8,
    alignItems:   'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  nextTextArea: {
    flex: 1,
    gap:  1,
  },
  nextPrefix: {
    fontSize:      10,
    fontWeight:    '700',
    color:         TEXT_F,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  nextTitle: {
    fontSize:   13,
    fontWeight: '600',
    color:      TEXT_W,
    lineHeight: 18,
  },

  // Max level celebration
  maxRow: {
    flexDirection: 'row',
    alignItems:    'center',
    justifyContent: 'center',
    gap:           6,
    paddingVertical: 6,
  },
  maxText: {
    fontSize:   13,
    fontWeight: '700',
  },
});
