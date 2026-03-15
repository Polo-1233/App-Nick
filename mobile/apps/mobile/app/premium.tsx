/**
 * premium.tsx — Premium membership screen
 *
 * Shown when user has an active Premium subscription.
 * Displays: badge + plan card + renewal + unlocked features.
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter }    from 'expo-router';
import { Ionicons }     from '@expo/vector-icons';
import { usePremiumGate }   from '../lib/use-premium-gate';
import { MascotImage }      from '../components/ui/MascotImage';

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:      '#0B1220',
  card:    '#1A2436',
  cardHL:  '#0D1D32',
  accent:  '#4DA3FF',
  gold:    '#F5A623',
  success: '#3DDC97',
  text:    '#E6EDF7',
  sub:     '#9FB0C5',
  muted:   '#6B7F99',
  border:  'rgba(255,255,255,0.07)',
};

const MANAGE_URL = 'https://apps.apple.com/account/subscriptions';

// ─── Unlocked features ────────────────────────────────────────────────────────
const FEATURES = [
  { icon: 'moon-outline',           label: 'Personalized sleep planning'  },
  { icon: 'analytics-outline',      label: 'Advanced recovery insights'   },
  { icon: 'chatbubble-outline',     label: 'Priority AI coaching'         },
  { icon: 'airplane-outline',       label: 'Jet lag adaptation'           },
  { icon: 'pulse-outline',          label: 'Fatigue analysis'             },
];

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function PremiumScreen() {
  const router              = useRouter();
  const { isPremium }       = usePremiumGate();

  // Mock renewal date — replace with real RevenueCat expiry when wired
  const renewalDate = 'April 15, 2026';

  function openManage() {
    Linking.openURL(MANAGE_URL).catch(() => {});
  }

  // ── Upsell — non-premium users ────────────────────────────────────────────
  if (!isPremium) {
    return (
      <SafeAreaView style={s.root} edges={['top', 'bottom']}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={s.back}>
            <Ionicons name="chevron-back" size={22} color={C.text} />
          </Pressable>
          <Text style={s.title}>Premium</Text>
        </View>
        <View style={s.upsellWrap}>
          <MascotImage emotion="encourageant" style={{ width: 80, height: 80, marginBottom: 24 }} />
          <Text style={s.upsellTitle}>Unlock Premium</Text>
          <Text style={s.upsellSub}>Get full access to R-Lo coaching, advanced insights and personalized sleep planning.</Text>
          <Pressable style={s.ctaBtn} onPress={() => router.push('/subscription')}>
            <Text style={s.ctaTxt}>View plans</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Premium member view ───────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.back}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <Text style={s.title}>Premium</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Premium badge */}
        <View style={s.badgeRow}>
          <View style={s.badge}>
            <Ionicons name="star" size={14} color={C.gold} />
            <Text style={s.badgeTxt}>Premium member</Text>
          </View>
        </View>

        {/* Plan card */}
        <View style={[s.planCard]}>
          {/* Mascot top-right */}
          <View style={s.mascotWrap}>
            <MascotImage emotion="celebration" style={{ width: 64, height: 64 }} />
          </View>

          <Text style={s.planName}>R-Lo Premium</Text>
          <View style={s.activeRow}>
            <View style={s.activeDot} />
            <Text style={s.activeLabel}>Active</Text>
          </View>

          <View style={s.divider} />

          <View style={s.renewRow}>
            <Ionicons name="calendar-outline" size={15} color={C.muted} />
            <Text style={s.renewTxt}>Renews {renewalDate}</Text>
          </View>
        </View>

        {/* Manage button */}
        <Pressable
          style={({ pressed }) => [s.manageBtn, pressed && { opacity: 0.8 }]}
          onPress={openManage}
        >
          <Ionicons name="card-outline" size={18} color={C.accent} />
          <Text style={s.manageTxt}>Manage subscription</Text>
          <Ionicons name="chevron-forward" size={15} color={C.muted} />
        </Pressable>

        {/* Unlocked features */}
        <View style={s.featuresWrap}>
          <Text style={s.featuresTitle}>What's included</Text>
          <View style={s.featuresCard}>
            {FEATURES.map(({ icon, label }, i) => (
              <View key={label} style={[s.featureRow, i < FEATURES.length - 1 && s.featureBorder]}>
                <View style={s.featureIcon}>
                  <Ionicons name={icon as any} size={18} color={C.accent} />
                </View>
                <Text style={s.featureLabel}>{label}</Text>
                <Ionicons name="checkmark-circle" size={18} color={C.success} />
              </View>
            ))}
          </View>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  scroll: { paddingTop: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingTop: 8, paddingBottom: 16 },
  back:   { padding: 8 },
  title:  { fontSize: 24, fontWeight: '800', color: C.text },

  // Badge
  badgeRow: { alignItems: 'center', marginBottom: 20 },
  badge:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: `${C.gold}18`, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: `${C.gold}40` },
  badgeTxt: { fontSize: 13, fontWeight: '700', color: C.gold },

  // Plan card
  planCard:  { marginHorizontal: 16, backgroundColor: C.cardHL, borderRadius: 22, padding: 24, borderWidth: 1.5, borderColor: `${C.accent}35`, marginBottom: 14, overflow: 'hidden' },
  mascotWrap:{ position: 'absolute', right: 20, top: 20 },
  planName:  { fontSize: 22, fontWeight: '800', color: C.text, marginBottom: 8 },
  activeRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.success },
  activeLabel:{ fontSize: 14, fontWeight: '600', color: C.success },
  divider:   { height: 1, backgroundColor: C.border, marginVertical: 18 },
  renewRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  renewTxt:  { fontSize: 14, color: C.muted },

  // Manage button
  manageBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, backgroundColor: C.card, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 18, marginBottom: 28 },
  manageTxt: { flex: 1, fontSize: 15, fontWeight: '600', color: C.text },

  // Features
  featuresWrap:  { paddingHorizontal: 16 },
  featuresTitle: { fontSize: 12, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, marginLeft: 2 },
  featuresCard:  { backgroundColor: C.card, borderRadius: 18, overflow: 'hidden' },
  featureRow:    { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16 },
  featureBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  featureIcon:   { width: 36, height: 36, borderRadius: 10, backgroundColor: `${C.accent}15`, alignItems: 'center', justifyContent: 'center' },
  featureLabel:  { flex: 1, fontSize: 15, color: C.text, fontWeight: '500' },

  // Upsell
  upsellWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  upsellTitle: { fontSize: 26, fontWeight: '800', color: C.text, textAlign: 'center', marginBottom: 12 },
  upsellSub:   { fontSize: 15, color: C.sub, textAlign: 'center', lineHeight: 24, marginBottom: 32 },
  ctaBtn:      { backgroundColor: C.accent, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 40 },
  ctaTxt:      { fontSize: 16, fontWeight: '800', color: '#0B1220' },
});
