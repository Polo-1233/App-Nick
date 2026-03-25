/**
 * BadgeCase.tsx — Visual badge display for the profile/account screen
 *
 * Shows all badges in a grid. Earned = full colour. Locked = dim + lock icon.
 * Tapping a badge shows a brief description tooltip.
 */

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { loadBadges, type BadgeStatus } from '../lib/badges';

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:      '#0a0a3a',
  card:    '#141466',
  surface2:'#1c1c7a',
  text:    '#E6EDF7',
  sub:     '#9FB0C5',
  muted:   '#6B7F99',
  border:  'rgba(255,255,255,0.07)',
};

const TIER_LABELS: Record<string, string> = {
  bronze:   'Bronze',
  silver:   'Silver',
  gold:     'Gold',
  platinum: 'Platinum',
};

// ─── Badge cell ───────────────────────────────────────────────────────────────
function BadgeCell({ badge, onPress }: { badge: BadgeStatus; onPress: () => void }) {
  const color  = badge.earned ? badge.color : C.muted;
  const opacity = badge.earned ? 1 : 0.35;

  return (
    <Pressable
      style={({ pressed }) => [bc.cell, { opacity: pressed ? 0.7 : opacity }]}
      onPress={onPress}
    >
      <View style={[bc.iconWrap, { backgroundColor: `${color}22`, borderColor: `${color}44` }]}>
        <Ionicons name={badge.icon as any} size={26} color={color} />
        {!badge.earned && (
          <View style={bc.lockOverlay}>
            <Ionicons name="lock-closed" size={10} color={C.muted} />
          </View>
        )}
      </View>
      <Text style={[bc.label, { color: badge.earned ? C.text : C.muted }]} numberOfLines={2}>
        {badge.title}
      </Text>
      <Text style={[bc.tier, { color: badge.earned ? color : C.muted }]}>
        {TIER_LABELS[badge.tier]}
      </Text>
    </Pressable>
  );
}

const bc = StyleSheet.create({
  cell: {
    width:          '30%',
    alignItems:     'center',
    marginBottom:   20,
    gap:            6,
  },
  iconWrap: {
    width:          58,
    height:         58,
    borderRadius:   16,
    borderWidth:    1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  lockOverlay: {
    position:       'absolute',
    bottom:         -4,
    right:          -4,
    backgroundColor: C.surface2,
    borderRadius:   8,
    padding:        3,
  },
  label: {
    fontSize:       11,
    fontWeight:     '600',
    textAlign:      'center',
    lineHeight:     14,
  },
  tier: {
    fontSize:       10,
    fontWeight:     '500',
    textTransform:  'uppercase',
    letterSpacing:  0.5,
  },
});

// ─── Detail modal ─────────────────────────────────────────────────────────────
function BadgeModal({ badge, onClose }: { badge: BadgeStatus; onClose: () => void }) {
  const color = badge.earned ? badge.color : C.muted;

  const earnedDate = badge.earnedAt
    ? new Date(badge.earnedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={md.backdrop} onPress={onClose}>
        <View style={md.sheet}>
          <View style={[md.iconWrap, { backgroundColor: `${color}22`, borderColor: `${color}55` }]}>
            <Ionicons name={badge.icon as any} size={40} color={color} />
          </View>
          <Text style={md.title}>{badge.title}</Text>
          <Text style={[md.tierLabel, { color }]}>{TIER_LABELS[badge.tier]}</Text>
          <Text style={md.desc}>{badge.description}</Text>
          {badge.earned && earnedDate ? (
            <Text style={md.earnedAt}>Earned {earnedDate}</Text>
          ) : (
            <Text style={md.locked}>Not yet earned</Text>
          )}
          <Pressable style={md.closeBtn} onPress={onClose}>
            <Text style={md.closeTxt}>Close</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const md = StyleSheet.create({
  backdrop:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  sheet:     { backgroundColor: C.card, borderRadius: 24, padding: 28, alignItems: 'center', width: '100%', maxWidth: 340, gap: 8 },
  iconWrap:  { width: 80, height: 80, borderRadius: 22, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title:     { fontSize: 20, fontWeight: '800', color: C.text, textAlign: 'center' },
  tierLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  desc:      { fontSize: 14, color: C.sub, textAlign: 'center', lineHeight: 20, marginTop: 4 },
  earnedAt:  { fontSize: 12, color: C.muted, marginTop: 4 },
  locked:    { fontSize: 12, color: C.muted, fontStyle: 'italic', marginTop: 4 },
  closeBtn:  { marginTop: 16, backgroundColor: C.surface2, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 32 },
  closeTxt:  { fontSize: 15, fontWeight: '600', color: C.text },
});

// ─── BadgeCase (main export) ──────────────────────────────────────────────────
export function BadgeCase() {
  const [badges,   setBadges]   = useState<BadgeStatus[]>([]);
  const [selected, setSelected] = useState<BadgeStatus | null>(null);

  useEffect(() => {
    loadBadges().then(setBadges);
  }, []);

  const earned = badges.filter(b => b.earned).length;

  return (
    <View style={s.wrap}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.sectionTitle}>ACHIEVEMENTS</Text>
          <Text style={s.earnedCount}>{earned} / {badges.length} earned</Text>
        </View>
        <View style={[s.countBadge, earned === badges.length && s.countBadgeFull]}>
          <Ionicons name="trophy" size={14} color={earned === badges.length ? '#FBBF24' : C.muted} />
          <Text style={[s.countTxt, earned === badges.length && { color: '#FBBF24' }]}>{earned}</Text>
        </View>
      </View>

      {/* Grid */}
      <View style={s.grid}>
        {badges.map(badge => (
          <BadgeCell
            key={badge.id}
            badge={badge}
            onPress={() => setSelected(badge)}
          />
        ))}
      </View>

      {/* Detail modal */}
      {selected && (
        <BadgeModal badge={selected} onClose={() => setSelected(null)} />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap:         { marginBottom: 8 },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  earnedCount:  { fontSize: 13, color: C.sub, marginTop: 2 },
  countBadge:   { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.surface2, borderRadius: 10, paddingVertical: 5, paddingHorizontal: 10 },
  countBadgeFull: { backgroundColor: '#FBBF2422' },
  countTxt:     { fontSize: 13, fontWeight: '700', color: C.muted },
  grid:         { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 4 },
});
