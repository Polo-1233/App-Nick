/**
 * RhythmDepthCard — Cycle Mastery System UI
 *
 * Shows in ProfileScreen:
 *   - Current level name + tagline
 *   - Soft progress bar (no number)
 *   - Next unlock teaser
 *   - Tap → opens RhythmDepthModal (full journey)
 */

import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal,
  Animated, ScrollView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  getDepth, getProgressToNext, DEPTH_LEVELS,
  type DepthLevelInfo, type RhythmDepthState,
} from '../lib/rhythm-depth';

// ─── Tokens ───────────────────────────────────────────────────────────────────
const CARD   = '#141466';
const BORDER = 'rgba(28,159,218,0.15)';
const TEXT_W = '#FFFFFF';
const TEXT_M = '#A0B0CC';
const TEXT_F = '#6B8CAE';

// ─── Progress bar ─────────────────────────────────────────────────────────────
function DepthBar({ pct, color }: { pct: number; color: string }) {
  const width = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(width, { toValue: pct, duration: 900, useNativeDriver: false }).start();
  }, [pct, width]);

  return (
    <View style={pb.bg}>
      <Animated.View style={[pb.fill, {
        backgroundColor: color,
        width: width.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
      }]} />
    </View>
  );
}

const pb = StyleSheet.create({
  bg:   { height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
});

// ─── Journey modal ────────────────────────────────────────────────────────────
function JourneyModal({
  visible,
  onClose,
  state,
}: {
  visible: boolean;
  onClose: () => void;
  state:   RhythmDepthState;
}) {
  const { level: currentLevel } = getProgressToNext(state.signal);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={jm.root}>
        <View style={jm.header}>
          <Text style={jm.title}>Your Rhythm Journey</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={22} color={TEXT_F} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={jm.scroll} showsVerticalScrollIndicator={false}>
          {DEPTH_LEVELS.map((lvl, i) => {
            const isReached  = state.signal >= lvl.minSignal;
            const isCurrent  = lvl.id === currentLevel.id;
            const nextLvl    = DEPTH_LEVELS[i + 1];
            const { pct }    = isCurrent ? getProgressToNext(state.signal) : { pct: isReached ? 1 : 0 };

            return (
              <View key={lvl.id} style={[jm.levelWrap, isCurrent && jm.levelActive]}>
                {/* Level header */}
                <View style={jm.levelHeader}>
                  <View style={[jm.dot, { backgroundColor: isReached ? lvl.color : 'rgba(255,255,255,0.15)' }]}>
                    {isReached && <Ionicons name="checkmark" size={10} color="#000" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[jm.levelName, { color: isReached ? lvl.color : TEXT_F }]}>
                      {lvl.label}
                    </Text>
                    {isCurrent && (
                      <Text style={jm.levelTagline}>{lvl.tagline}</Text>
                    )}
                  </View>
                  {isCurrent && (
                    <View style={[jm.currentBadge, { borderColor: lvl.color }]}>
                      <Text style={[jm.currentBadgeTxt, { color: lvl.color }]}>Now</Text>
                    </View>
                  )}
                </View>

                {/* Progress bar on current level */}
                {isCurrent && (
                  <View style={jm.barWrap}>
                    <DepthBar pct={pct} color={lvl.color} />
                    {nextLvl && (
                      <Text style={jm.nextHint}>→ {nextLvl.label}</Text>
                    )}
                  </View>
                )}

                {/* Unlocks */}
                {isReached && (
                  <View style={jm.unlocks}>
                    {lvl.unlocks.map(u => (
                      <View key={u.id} style={jm.unlock}>
                        <Ionicons
                          name={u.type === 'insight' ? 'bulb-outline' : u.type === 'feature' ? 'settings-outline' : 'headset-outline'}
                          size={12}
                          color={lvl.color}
                        />
                        <Text style={jm.unlockTitle}>{u.title}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Locked unlocks (next level preview) */}
                {!isReached && i === DEPTH_LEVELS.indexOf(currentLevel) + 1 && (
                  <View style={jm.unlocks}>
                    {lvl.unlocks.slice(0, 2).map(u => (
                      <View key={u.id} style={[jm.unlock, { opacity: 0.4 }]}>
                        <Ionicons name="lock-closed-outline" size={12} color={TEXT_F} />
                        <Text style={[jm.unlockTitle, { color: TEXT_F }]}>{u.title}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const jm = StyleSheet.create({
  root:          { flex: 1, backgroundColor: '#0a0a3a' },
  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  title:         { fontSize: 18, fontWeight: '700', color: TEXT_W },
  scroll:        { paddingHorizontal: 20, paddingTop: 8 },
  levelWrap:     { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER, gap: 10 },
  levelActive:   { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 12, marginHorizontal: -12 },
  levelHeader:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot:           { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  levelName:     { fontSize: 15, fontWeight: '700' },
  levelTagline:  { fontSize: 12, color: TEXT_F, marginTop: 2 },
  currentBadge:  { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  currentBadgeTxt:{ fontSize: 10, fontWeight: '700' },
  barWrap:       { gap: 6 },
  nextHint:      { fontSize: 11, color: TEXT_F, textAlign: 'right' },
  unlocks:       { gap: 6, paddingLeft: 32 },
  unlock:        { flexDirection: 'row', alignItems: 'center', gap: 6 },
  unlockTitle:   { fontSize: 12, color: TEXT_M },
});

// ─── Main card ────────────────────────────────────────────────────────────────

export function RhythmDepthCard() {
  const [state,       setState]       = useState<RhythmDepthState | null>(null);
  const [showJourney, setShowJourney] = useState(false);

  useEffect(() => {
    getDepth().then(setState).catch(() => {});
  }, []);

  if (!state) return null;

  const { level, next, pct } = getProgressToNext(state.signal);

  return (
    <>
      <Pressable
        onPress={() => setShowJourney(true)}
        style={({ pressed }) => [rc.card, pressed && { opacity: 0.8 }]}
      >
        {/* Header */}
        <View style={rc.header}>
          <View style={rc.headerLeft}>
            <View style={[rc.levelDot, { backgroundColor: level.color }]} />
            <Text style={[rc.levelName, { color: level.color }]}>{level.label}</Text>
          </View>
          <Text style={rc.journeyLink}>Journey ›</Text>
        </View>

        {/* Tagline */}
        <Text style={rc.tagline}>{level.tagline}</Text>

        {/* Progress bar — no number */}
        <DepthBar pct={pct} color={level.color} />

        {/* Next unlock */}
        {next && next.unlocks[0] && (
          <View style={rc.nextRow}>
            <Ionicons name="lock-closed-outline" size={11} color={TEXT_F} />
            <Text style={rc.nextText}>
              Next: {next.unlocks[0].title}
            </Text>
          </View>
        )}
        {!next && (
          <View style={rc.nextRow}>
            <Ionicons name="checkmark-circle-outline" size={11} color={level.color} />
            <Text style={[rc.nextText, { color: level.color }]}>All content unlocked</Text>
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

const rc = StyleSheet.create({
  card:       { backgroundColor: CARD, borderRadius: 20, padding: 18, gap: 10, borderWidth: 1, borderColor: BORDER },
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  levelDot:   { width: 10, height: 10, borderRadius: 5 },
  levelName:  { fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
  journeyLink:{ fontSize: 12, color: '#1c9fda', fontWeight: '600' },
  tagline:    { fontSize: 13, color: TEXT_M, lineHeight: 18 },
  nextRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  nextText:   { fontSize: 12, color: TEXT_F, flex: 1 },
});
