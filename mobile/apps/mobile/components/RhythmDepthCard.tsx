/**
 * RhythmDepthCard — Cycle Mastery System UI
 *
 * 3 zones:
 *   1. Level + tagline + progress bar
 *   2. What you've already unlocked (1-2 items)
 *   3. What's coming next (concrete teaser)
 *
 * Tap → Journey modal (full timeline)
 */

import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal,
  Animated, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  getDepth, getProgressToNext, DEPTH_LEVELS,
  getUnlockedContent,
  type RhythmDepthState,
} from '../lib/rhythm-depth';

// ─── Tokens ───────────────────────────────────────────────────────────────────
const NAVY   = '#141466';
const ACCENT = '#1c9fda';
const TEXT_W = '#FFFFFF';
const TEXT_M = '#A0B0CC';
const TEXT_F = '#6B8CAE';
const BORDER = 'rgba(28,159,218,0.15)';
const GOLD   = '#F5A623';

// ─── Animated progress bar ────────────────────────────────────────────────────
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
  bg:   { height: 5, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' },
  fill: { height: 5, borderRadius: 3 },
});

// ─── Unlock icon ─────────────────────────────────────────────────────────────
function unlockIcon(type: string): keyof typeof Ionicons.glyphMap {
  if (type === 'insight') return 'bulb-outline';
  if (type === 'feature') return 'sparkles-outline';
  return 'headset-outline';
}

// ─── Journey modal ────────────────────────────────────────────────────────────
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

        {/* How it works */}
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
              <View key={lvl.id} style={[jm.levelBlock, isCurrent && { borderColor: `${lvl.color}40`, borderWidth: 1 }]}>
                {/* Level name row */}
                <View style={jm.levelRow}>
                  <View style={[jm.levelDot, { backgroundColor: isReached ? lvl.color : 'rgba(255,255,255,0.12)' }]}>
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

                {/* Tagline */}
                <Text style={[jm.tagline, { color: isCurrent ? TEXT_M : TEXT_F }]}>{lvl.tagline}</Text>

                {/* Progress bar (current only) */}
                {isCurrent && nextLvl && (
                  <View style={jm.barRow}>
                    <DepthBar pct={pct} color={lvl.color} />
                    <Text style={jm.nextLvlHint}>→ {nextLvl.label}</Text>
                  </View>
                )}

                {/* Unlocks */}
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

const jm = StyleSheet.create({
  root:          { flex: 1, backgroundColor: '#0a0a3a' },
  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  title:         { fontSize: 18, fontWeight: '700', color: TEXT_W },
  explainer:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginHorizontal: 20, marginBottom: 16, backgroundColor: `${ACCENT}12`, padding: 12, borderRadius: 12 },
  explainerTxt:  { flex: 1, fontSize: 12, color: TEXT_M, lineHeight: 18 },
  scroll:        { paddingHorizontal: 20, gap: 12 },
  levelBlock:    { backgroundColor: NAVY, borderRadius: 16, padding: 16, gap: 10, borderWidth: 1, borderColor: BORDER },
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

  useEffect(() => { getDepth().then(setState).catch(() => {}); }, []);

  if (!state) return null;

  const { level, next, pct } = getProgressToNext(state.signal);
  const unlocked = getUnlockedContent(state.signal);
  const shownUnlocks = unlocked.slice(-2); // show last 2 unlocked items

  return (
    <>
      <Pressable
        onPress={() => setShowJourney(true)}
        style={({ pressed }) => [rc.card, pressed && { opacity: 0.85 }]}
      >
        {/* ── Top: level + progress ── */}
        <View style={rc.topRow}>
          <View style={rc.levelPill}>
            <View style={[rc.levelDot, { backgroundColor: level.color }]} />
            <Text style={[rc.levelName, { color: level.color }]}>{level.label}</Text>
          </View>
          <Text style={rc.viewJourney}>View journey ›</Text>
        </View>

        <Text style={rc.tagline}>{level.tagline}</Text>

        <DepthBar pct={pct} color={level.color} />

        <View style={rc.divider} />

        {/* ── Middle: what you've unlocked ── */}
        {shownUnlocks.length > 0 && (
          <View style={rc.section}>
            <Text style={rc.sectionLabel}>
              <Ionicons name="checkmark-circle" size={11} color={level.color} /> Unlocked for you
            </Text>
            {shownUnlocks.map(u => (
              <View key={u.id} style={rc.unlockedRow}>
                <View style={[rc.unlockIcon, { backgroundColor: `${level.color}18` }]}>
                  <Ionicons name={unlockIcon(u.type)} size={12} color={level.color} />
                </View>
                <Text style={rc.unlockedTitle}>{u.title}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Bottom: what's next ── */}
        {next && next.unlocks[0] && (
          <>
            <View style={rc.divider} />
            <View style={rc.section}>
              <Text style={rc.sectionLabel}>
                <Ionicons name="lock-closed-outline" size={11} color={TEXT_F} /> Next unlock — {next.label}
              </Text>
              <View style={rc.nextBlock}>
                <View style={rc.nextIconWrap}>
                  <Ionicons name={unlockIcon(next.unlocks[0].type)} size={14} color={GOLD} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={rc.nextTitle}>{next.unlocks[0].title}</Text>
                  <Text style={rc.nextDesc}>{next.unlocks[0].description}</Text>
                </View>
              </View>
            </View>
          </>
        )}

        {!next && (
          <>
            <View style={rc.divider} />
            <View style={rc.allUnlockedRow}>
              <Ionicons name="star" size={14} color={level.color} />
              <Text style={[rc.allUnlockedTxt, { color: level.color }]}>All content unlocked — R90 Integrated</Text>
            </View>
          </>
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
  card:          { backgroundColor: NAVY, borderRadius: 20, padding: 18, gap: 12, borderWidth: 1, borderColor: BORDER },
  topRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  levelPill:     { flexDirection: 'row', alignItems: 'center', gap: 7 },
  levelDot:      { width: 10, height: 10, borderRadius: 5 },
  levelName:     { fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  viewJourney:   { fontSize: 12, color: ACCENT, fontWeight: '600' },
  tagline:       { fontSize: 13, color: TEXT_M, lineHeight: 18 },
  divider:       { height: 1, backgroundColor: 'rgba(255,255,255,0.07)' },
  section:       { gap: 8 },
  sectionLabel:  { fontSize: 11, fontWeight: '700', color: TEXT_F, textTransform: 'uppercase', letterSpacing: 0.8 },
  unlockedRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  unlockIcon:    { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  unlockedTitle: { fontSize: 13, color: TEXT_W, fontWeight: '500', flex: 1 },
  nextBlock:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: `${GOLD}0D`, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: `${GOLD}20` },
  nextIconWrap:  { width: 30, height: 30, borderRadius: 9, backgroundColor: `${GOLD}18`, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  nextTitle:     { fontSize: 13, fontWeight: '700', color: TEXT_W, lineHeight: 18 },
  nextDesc:      { fontSize: 12, color: TEXT_M, lineHeight: 17, marginTop: 2 },
  allUnlockedRow:{ flexDirection: 'row', alignItems: 'center', gap: 8 },
  allUnlockedTxt:{ fontSize: 13, fontWeight: '600' },
});
