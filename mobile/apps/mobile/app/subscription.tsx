/**
 * subscription.tsx — Premium paywall
 *
 * Revolut-style: Free + Premium side by side on one screen.
 * Monthly / Yearly toggle on Premium card.
 * Yearly highlighted as best value.
 */

import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { useRouter }     from 'expo-router';
import { Ionicons }      from '@expo/vector-icons';
import { purchasePackage, restorePurchases, getCurrentOffering } from '../lib/purchases';
import { usePremiumGate } from '../lib/use-premium-gate';
import { HapticsLight }  from '../utils/haptics';

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:        '#0B1220',
  card:      '#1A2436',
  cardPrem:  '#142035',   // slightly deeper blue for premium card
  surface2:  '#243046',
  accent:    '#F5A623',   // orange — button only
  blue:      '#4DA3FF',
  text:      '#E6EDF7',
  textSub:   '#9FB0C5',
  textMuted: '#6B7F99',
  success:   '#3DDC97',
  border:    'rgba(255,255,255,0.07)',
};

// ─── Feature lists ────────────────────────────────────────────────────────────
const FREE_FEATURES = [
  { icon: 'moon-outline',          text: 'Sleep planning'           },
  { icon: 'chatbubble-outline',    text: 'R-Lo coaching'            },
  { icon: 'sync-outline',          text: 'Cycle tracking'           },
];

const PREMIUM_FEATURES = [
  { icon: 'analytics-outline',     text: 'Understand your sleep cycles'     },
  { icon: 'trending-up-outline',   text: 'Weekly recovery insights'          },
  { icon: 'airplane-outline',      text: 'Recover faster from jet lag'       },
  { icon: 'calendar-outline',      text: 'Auto-adapt your schedule'          },
  { icon: 'battery-charging-outline', text: 'Fatigue analysis'              },
  { icon: 'checkmark-circle-outline', text: 'Everything in Free'            },
];

// ─── Feature row ─────────────────────────────────────────────────────────────
function FeatureRow({ icon, text, isPremium }: { icon: string; text: string; isPremium?: boolean }) {
  return (
    <View style={f.row}>
      <Ionicons name={icon as any} size={15} color={isPremium ? C.blue : C.success} />
      <Text style={[f.text, { color: isPremium ? C.text : C.textSub }]}>{text}</Text>
    </View>
  );
}
const f = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  text: { fontSize: 14, fontWeight: '400', flex: 1, lineHeight: 20 },
});

// ─── Plan card ────────────────────────────────────────────────────────────────
type BillingCycle = 'monthly' | 'yearly';

function FreeCard() {
  return (
    <View style={p.card}>
      <View style={p.badgeFree}>
        <Text style={p.badgeFreeText}>Current plan</Text>
      </View>
      <Text style={p.planName}>Free</Text>
      <Text style={p.freePriceLine}>Always free</Text>
      <View style={p.divider} />
      <View style={p.features}>
        {FREE_FEATURES.map(({ icon, text }) => (
          <FeatureRow key={text} icon={icon} text={text} />
        ))}
      </View>
    </View>
  );
}

function PremiumCard({
  billing, setBilling, isPremium, loading, onPurchase,
}: {
  billing:    BillingCycle;
  setBilling: (b: BillingCycle) => void;
  isPremium:  boolean;
  loading:    boolean;
  onPurchase: () => void;
}) {
  const isYearly     = billing === 'yearly';
  const monthlyPrice = '$4.99';
  const yearlyTotal  = '$39';
  const yearlyMonthly= '$3.25';

  return (
    <View style={p.cardPremium}>
      {/* Best value label */}
      <View style={p.badgePremium}>
        <Ionicons name="star" size={10} color={C.accent} />
        <Text style={p.badgePremiumText}>Best value</Text>
      </View>

      <Text style={[p.planName, { color: C.blue }]}>Premium</Text>

      {/* Billing toggle */}
      <View style={p.toggle}>
        <Pressable
          style={[p.toggleBtn, !isYearly && p.toggleBtnActive]}
          onPress={() => { HapticsLight(); setBilling('monthly'); }}
        >
          <Text style={[p.toggleBtnText, !isYearly && p.toggleBtnTextActive]}>Monthly</Text>
        </Pressable>
        <Pressable
          style={[p.toggleBtn, isYearly && p.toggleBtnActive]}
          onPress={() => { HapticsLight(); setBilling('yearly'); }}
        >
          <Text style={[p.toggleBtnText, isYearly && p.toggleBtnTextActive]}>Yearly</Text>
          {isYearly && (
            <View style={p.saveBadge}>
              <Text style={p.saveBadgeText}>–33%</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* Price */}
      {isYearly ? (
        <View style={p.priceBlock}>
          <View style={p.priceRow}>
            <Text style={p.priceMain}>{yearlyMonthly}</Text>
            <Text style={p.pricePeriod}> / month</Text>
          </View>
          <Text style={p.priceSub}>Billed yearly ({yearlyTotal})</Text>
        </View>
      ) : (
        <View style={p.priceBlock}>
          <View style={p.priceRow}>
            <Text style={p.priceMain}>{monthlyPrice}</Text>
            <Text style={p.pricePeriod}> / month</Text>
          </View>
          <Text style={p.priceSub}>Billed monthly</Text>
        </View>
      )}

      <View style={p.divider} />

      <View style={p.features}>
        {PREMIUM_FEATURES.map(({ icon, text }) => (
          <FeatureRow key={text} icon={icon} text={text} isPremium />
        ))}
      </View>

      {isPremium ? (
        <View style={p.activeBox}>
          <Ionicons name="checkmark-circle" size={18} color={C.success} />
          <Text style={p.activeTxt}>Premium is active</Text>
        </View>
      ) : (
        <Pressable style={[p.ctaBtn, loading && { opacity: 0.6 }]} onPress={onPurchase} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#0B1220" />
            : <Text style={p.ctaBtnText}>Get Premium</Text>
          }
        </Pressable>
      )}
    </View>
  );
}

const p = StyleSheet.create({
  // Free card
  card: {
    backgroundColor: C.card,
    borderRadius:    20,
    padding:         20,
    borderWidth:     1,
    borderColor:     C.border,
  },
  // Premium card
  cardPremium: {
    backgroundColor: C.cardPrem,
    borderRadius:    20,
    padding:         20,
    borderWidth:     1.5,
    borderColor:     `${C.blue}35`,
  },

  badgeFree:     { alignSelf: 'flex-start', backgroundColor: C.surface2, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 8 },
  badgeFreeText: { fontSize: 11, fontWeight: '600', color: C.textMuted },

  badgePremium:     { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: `${C.accent}18`, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 8, borderWidth: 1, borderColor: `${C.accent}35` },
  badgePremiumText: { fontSize: 11, fontWeight: '600', color: C.accent },

  planName:     { fontSize: 26, fontWeight: '900', color: C.text, marginBottom: 12 },
  freePriceLine:{ fontSize: 14, color: C.textMuted, marginBottom: 12 },

  // Toggle
  toggle:          { flexDirection: 'row', backgroundColor: C.surface2, borderRadius: 12, padding: 3, marginBottom: 16 },
  toggleBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 10, gap: 6 },
  toggleBtnActive: { backgroundColor: C.card },
  toggleBtnText:      { fontSize: 13, fontWeight: '600', color: C.textMuted },
  toggleBtnTextActive:{ fontSize: 13, fontWeight: '700', color: C.text },
  saveBadge:     { backgroundColor: `${C.success}20`, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  saveBadgeText: { fontSize: 10, fontWeight: '700', color: C.success },

  // Price block
  priceBlock: { marginBottom: 16 },
  priceRow:   { flexDirection: 'row', alignItems: 'baseline' },
  priceMain:  { fontSize: 34, fontWeight: '900', color: C.text },
  pricePeriod:{ fontSize: 15, color: C.textSub, fontWeight: '500' },
  priceSub:   { fontSize: 12, color: C.textMuted, marginTop: 3 },

  divider:  { height: 1, backgroundColor: C.border, marginBottom: 14 },
  features: { gap: 2 },

  activeBox: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', paddingTop: 14 },
  activeTxt: { fontSize: 14, fontWeight: '600', color: C.success },

  ctaBtn:     { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  ctaBtnText: { fontSize: 16, fontWeight: '700', color: '#0B1220' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function SubscriptionScreen() {
  const router = useRouter();
  const { isPremium, refresh: refreshPremium } = usePremiumGate();
  const [billing,  setBilling]  = useState<BillingCycle>('yearly');
  const [loading,  setLoading]  = useState(false);

  async function handlePurchase() {
    HapticsLight();
    setLoading(true);
    try {
      const offeringResult = await getCurrentOffering();
      const offering       = offeringResult.offering;
      const pkgType        = billing === 'yearly' ? 'ANNUAL' : 'MONTHLY';
      const pkg = offering?.availablePackages.find((p: any) => p.packageType === pkgType)
               ?? offering?.availablePackages[0];
      if (!pkg) { Alert.alert('Not available', 'No subscription plans available right now.'); return; }
      const result = await purchasePackage(pkg);
      if (result.ok) {
        await refreshPremium();
        Alert.alert('Welcome to Premium! 🎉', 'Your subscription is active.', [
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
      if (result.ok) { await refreshPremium(); Alert.alert('Restored', 'Your purchases have been restored.'); }
      else Alert.alert('Nothing to restore', 'No previous purchases found.');
    } catch {
      Alert.alert('Error', 'Could not restore. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Header */}
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={s.backBtn}>
            <Ionicons name="chevron-back" size={22} color={C.textSub} />
          </Pressable>
        </View>

        {/* Headline */}
        <Text style={s.title}>Upgrade your{'\n'}sleep recovery</Text>
        <Text style={s.sub}>Simple, transparent pricing.</Text>

        {/* Cards */}
        <View style={s.cards}>
          <FreeCard />
          <PremiumCard
            billing={billing}
            setBilling={setBilling}
            isPremium={isPremium}
            loading={loading}
            onPurchase={() => { void handlePurchase(); }}
          />
        </View>

        {/* Restore */}
        <Pressable style={s.restoreBtn} onPress={() => { void handleRestore(); }} disabled={loading}>
          <Text style={s.restoreBtnText}>Restore purchase</Text>
        </Pressable>

        <View style={{ height: 16 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Screen styles ────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 16 },

  header:  { paddingTop: 8, paddingBottom: 4 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },

  title: { fontSize: 32, fontWeight: '900', color: C.text, lineHeight: 38, marginTop: 20, marginBottom: 6 },
  sub:   { fontSize: 14, color: C.textSub, marginBottom: 24 },

  cards: { gap: 16 },

  restoreBtn:     { alignItems: 'center', paddingVertical: 20 },
  restoreBtnText: { fontSize: 13, color: C.textMuted },
});
