/**
 * subscription.tsx — Calm-style vertical paywall
 *
 * Single scrollable page:
 *   1. Header     — title + subtitle
 *   2. Benefits   — 4 key outcomes
 *   3. Toggle     — Monthly / Yearly
 *   4. Pricing    — 2 cards (yearly highlighted)
 *   5. CTA        — "Start free trial"
 *   6. Footer     — trial + cancel copy
 */

import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter }    from 'expo-router';
import { Ionicons }     from '@expo/vector-icons';
import { purchasePackage, restorePurchases, getCurrentOffering } from '../lib/purchases';
import { usePremiumGate } from '../lib/use-premium-gate';
import { HapticsLight }   from '../utils/haptics';

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:      '#0B1220',
  card:    '#1A2436',
  cardHL:  '#0E1E35',   // yearly highlighted card
  surface: '#243046',
  accent:  '#F5A623',   // orange — CTA only
  blue:    '#4DA3FF',
  text:    '#E6EDF7',
  sub:     '#9FB0C5',
  muted:   '#6B7F99',
  success: '#3DDC97',
  border:  'rgba(255,255,255,0.08)',
};

// ─── Benefits ─────────────────────────────────────────────────────────────────
const BENEFITS = [
  { icon: 'sunny-outline',          text: 'Wake up with more energy every morning'      },
  { icon: 'moon-outline',           text: 'Let AI choose the perfect time for you to sleep' },
  { icon: 'trending-up-outline',    text: 'Build a stable sleep rhythm automatically'   },
  { icon: 'flash-outline',          text: 'Recover faster from fatigue and jet lag'     },
];

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function SubscriptionScreen() {
  const router                         = useRouter();
  const { isPremium, refresh }         = usePremiumGate();
  const [yearly,   setYearly]          = useState(true);
  // Pricing
  const MONTHLY_PRICE  = '$9.99';
  const YEARLY_TOTAL   = '$79.99';
  const YEARLY_MONTHLY = '$6.66';
  const [loading,  setLoading]         = useState(false);

  // ── Purchase ─────────────────────────────────────────────────────────────
  async function handlePurchase() {
    HapticsLight();
    setLoading(true);
    try {
      const { offering } = await getCurrentOffering();
      const pkgType = yearly ? 'ANNUAL' : 'MONTHLY';
      const pkg = offering?.availablePackages.find((p: any) => p.packageType === pkgType)
               ?? offering?.availablePackages[0];
      if (!pkg) { Alert.alert('Not available', 'No plans available right now.'); return; }
      const result = await purchasePackage(pkg);
      if (result.ok) {
        await refresh();
        Alert.alert('Welcome to Premium! 🎉', 'Your subscription is now active.', [
          { text: 'Continue', onPress: () => router.back() },
        ]);
      } else if (result.error !== 'cancelled') {
        Alert.alert('Purchase failed', result.error ?? 'Please try again.');
      }
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRestore() {
    HapticsLight();
    setLoading(true);
    try {
      const result = await restorePurchases();
      if (result.ok) { await refresh(); Alert.alert('Restored', 'Your purchases have been restored.'); }
      else Alert.alert('Nothing to restore', 'No previous purchases found.');
    } catch {
      Alert.alert('Error', 'Could not restore.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        bounces={false}
      >

        {/* ── Close button ── */}
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.closeBtn}>
          <Ionicons name="close" size={20} color={C.sub} />
        </Pressable>

        {/* ── 1. Header ── */}
        <View style={s.header}>
          <Text style={s.title}>Your sleep plan{'\n'}is ready</Text>
          <Text style={s.subtitle}>Unlock your AI sleep coach</Text>
        </View>

        {/* ── 2. Benefits ── */}
        <View style={s.benefits}>
          {BENEFITS.map(({ icon, text }) => (
            <View key={text} style={s.benefitRow}>
              <View style={s.benefitIcon}>
                <Ionicons name={icon as any} size={18} color={C.blue} />
              </View>
              <Text style={s.benefitText}>{text}</Text>
            </View>
          ))}
        </View>

        {/* ── 3. Toggle ── */}
        <View style={s.toggleRow}>
          <Text style={[s.toggleLabel, !yearly && s.toggleLabelActive]}>Monthly</Text>
          <Switch
            value={yearly}
            onValueChange={v => { HapticsLight(); setYearly(v); }}
            trackColor={{ false: C.surface, true: C.blue }}
            thumbColor={C.text}
            style={s.switch}
          />
          <Text style={[s.toggleLabel, yearly && s.toggleLabelActive]}>Yearly</Text>
          {yearly && (
            <View style={s.savePill}>
              <Text style={s.savePillText}>Save 33%</Text>
            </View>
          )}
        </View>

        {/* ── 4. Pricing cards ── */}
        <View style={s.cards}>

          {/* Monthly */}
          <Pressable
            style={[s.card, !yearly && s.cardSelected]}
            onPress={() => { HapticsLight(); setYearly(false); }}
          >
            <View style={s.cardTop}>
              <Text style={s.planName}>Monthly</Text>
              {!yearly && <View style={s.selectedDot} />}
            </View>
            <Text style={s.planPrice}>{MONTHLY_PRICE}<Text style={s.planPer}> / mo</Text></Text>
            <Text style={s.planNote}>Cancel anytime</Text>
          </Pressable>

          {/* Yearly — highlighted */}
          <Pressable
            style={[s.card, s.cardYearly, yearly && s.cardSelected]}
            onPress={() => { HapticsLight(); setYearly(true); }}
          >
            <View style={s.cardTop}>
              <Text style={[s.planName, { color: C.blue }]}>Yearly</Text>
              <View style={s.bestBadge}>
                <Text style={s.bestBadgeText}>Best value</Text>
              </View>
            </View>
            <Text style={s.planPrice}>{YEARLY_MONTHLY}<Text style={s.planPer}> / mo</Text></Text>
            <Text style={s.planYearlyTotal}>{YEARLY_TOTAL} / year</Text>
            <Text style={s.planNote}>Save 33% vs monthly</Text>
          </Pressable>

        </View>

        {/* ── 5. CTA ── */}
        {isPremium ? (
          <View style={s.activeBox}>
            <Ionicons name="checkmark-circle" size={20} color={C.success} />
            <Text style={s.activeTxt}>Premium is active</Text>
          </View>
        ) : (
          <Pressable
            style={[s.cta, loading && { opacity: 0.6 }]}
            onPress={() => { void handlePurchase(); }}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#0B1220" />
              : <Text style={s.ctaTxt}>Start free trial</Text>
            }
          </Pressable>
        )}

        {/* ── 6. Footer ── */}
        <Text style={s.footer}>
          {yearly
            ? `Free for 7 days, then ${YEARLY_TOTAL}/year. Cancel anytime.`
            : `Free for 7 days, then ${MONTHLY_PRICE}/month. Cancel anytime.`}
        </Text>

        <Pressable style={s.restoreBtn} onPress={() => { void handleRestore(); }} disabled={loading}>
          <Text style={s.restoreTxt}>Restore purchase</Text>
        </Pressable>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 24, paddingBottom: 32 },

  closeBtn: { alignSelf: 'flex-end', marginTop: 8, padding: 4 },

  // Header
  header:   { marginTop: 12, marginBottom: 32 },
  title:    { fontSize: 32, fontWeight: '900', color: C.text, lineHeight: 40, marginBottom: 10 },
  subtitle: { fontSize: 17, color: C.sub, lineHeight: 24 },

  // Benefits
  benefits:    { gap: 16, marginBottom: 36 },
  benefitRow:  { flexDirection: 'row', alignItems: 'center', gap: 14 },
  benefitIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: `${C.blue}15`, alignItems: 'center', justifyContent: 'center' },
  benefitText: { fontSize: 16, color: C.text, fontWeight: '500', flex: 1, lineHeight: 22 },

  // Toggle
  toggleRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 20 },
  toggleLabel:      { fontSize: 15, color: C.muted, fontWeight: '500' },
  toggleLabelActive:{ color: C.text, fontWeight: '700' },
  switch:           { transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] },
  savePill:         { backgroundColor: `${C.success}20`, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: `${C.success}40` },
  savePillText:     { fontSize: 11, fontWeight: '700', color: C.success },

  // Cards
  cards:        { flexDirection: 'row', gap: 12, marginBottom: 28 },
  card:         { flex: 1, backgroundColor: C.card, borderRadius: 18, padding: 18, borderWidth: 2, borderColor: 'transparent', gap: 6 },
  cardYearly:   { backgroundColor: C.cardHL },
  cardSelected: { borderColor: C.blue },
  cardTop:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  planName:     { fontSize: 16, fontWeight: '700', color: C.text },
  planPrice:    { fontSize: 26, fontWeight: '900', color: C.text },
  planPer:      { fontSize: 14, fontWeight: '500', color: C.sub },
  planYearlyTotal: { fontSize: 13, color: C.muted, marginTop: -2 },
  planNote:     { fontSize: 12, color: C.muted, marginTop: 2 },
  selectedDot:  { width: 10, height: 10, borderRadius: 5, backgroundColor: C.blue },
  bestBadge:    { backgroundColor: `${C.blue}20`, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: `${C.blue}40` },
  bestBadgeText:{ fontSize: 10, fontWeight: '700', color: C.blue },

  // CTA
  cta:    { backgroundColor: C.accent, borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginBottom: 16 },
  ctaTxt: { fontSize: 17, fontWeight: '800', color: '#0B1220', letterSpacing: 0.2 },

  activeBox: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', paddingVertical: 18, marginBottom: 16 },
  activeTxt: { fontSize: 15, fontWeight: '600', color: C.success },

  // Footer
  footer:     { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  restoreBtn: { alignItems: 'center', paddingVertical: 8 },
  restoreTxt: { fontSize: 13, color: C.muted },
});
