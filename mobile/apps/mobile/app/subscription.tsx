/**
 * subscription.tsx — Premium subscription screen
 *
 * Revolut-style horizontal slides: Free ← → Premium
 * Starts on Premium slide (index 1).
 * Keeps RevenueCat purchase logic intact.
 */

import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { purchasePackage, restorePurchases, getCurrentOffering } from '../lib/purchases';
import { usePremiumGate } from '../lib/use-premium-gate';
import { HapticsLight } from '../utils/haptics';

const { width: SCREEN_W } = Dimensions.get('window');

const C = {
  bg:        '#0B1220',
  card:      '#1A2436',
  surface2:  '#243046',
  accent:    '#F5A623',
  text:      '#E6EDF7',
  textSub:   '#9FB0C5',
  textMuted: '#6B7F99',
  success:   '#3DDC97',
  error:     '#F87171',
};

const FREE_FEATURES    = ['Sleep planning', 'R-Lo coaching', 'Cycle tracking'];
const PREMIUM_FEATURES = ['Advanced sleep analysis', 'Jet lag optimization', 'Auto schedule adaptation', 'Fatigue analysis', 'Everything in Free'];

function FeatureRow({ text, accent }: { text: string; accent?: boolean }) {
  return (
    <View style={f.row}>
      <View style={[f.dot, { backgroundColor: accent ? C.accent : C.success }]} />
      <Text style={[f.text, { color: accent ? C.text : C.textSub }]}>{text}</Text>
    </View>
  );
}
const f = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  dot:  { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 15, fontWeight: '400' },
});

export default function SubscriptionScreen() {
  const router    = useRouter();
  const { isPremium, refresh: refreshPremium } = usePremiumGate();
  const scrollRef = useRef<ScrollView>(null);
  const [activeSlide, setActiveSlide] = useState(1); // Start on Premium
  const [loading, setLoading]         = useState(false);

  // Scroll to Premium on mount
  const onScrollViewReady = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ x: SCREEN_W, animated: false });
    }, 50);
  }, []);

  function handleScroll(e: any) {
    const x = e.nativeEvent.contentOffset.x;
    setActiveSlide(x < SCREEN_W / 2 ? 0 : 1);
  }

  async function handlePurchase() {
    HapticsLight();
    setLoading(true);
    try {
      const offeringResult = await getCurrentOffering();
      const offering = offeringResult.offering;
      const pkg = offering?.availablePackages.find((p: any) => p.packageType === 'MONTHLY')
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
      if (result.ok) {
        await refreshPremium();
        Alert.alert('Restored', 'Your purchases have been restored.');
      } else {
        Alert.alert('Nothing to restore', 'No previous purchases found.');
      }
    } catch {
      Alert.alert('Error', 'Could not restore. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>

      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={C.textSub} />
        </Pressable>
        <Text style={s.headerTitle}>Choose your plan</Text>
        <View style={{ width: 38 }} />
      </View>

      <Text style={s.headerSub}>Simple, transparent pricing.</Text>

      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onLayout={onScrollViewReady}
        style={s.slider}
        contentContainerStyle={{ width: SCREEN_W * 2 }}
      >
        {/* Slide 0 — Free */}
        <View style={[s.slide, { width: SCREEN_W }]}>
          <View style={s.planCard}>
            <View style={s.planBadge}>
              <Text style={s.planBadgeText}>Current plan</Text>
            </View>
            <Text style={s.planName}>Free</Text>
            <View style={s.featuresBox}>
              {FREE_FEATURES.map(t => <FeatureRow key={t} text={t} />)}
            </View>
          </View>
        </View>

        {/* Slide 1 — Premium */}
        <View style={[s.slide, { width: SCREEN_W }]}>
          <View style={[s.planCard, s.planCardPremium]}>
            <View style={[s.planBadge, { backgroundColor: `${C.accent}20`, borderColor: `${C.accent}40` }]}>
              <Ionicons name="star" size={11} color={C.accent} style={{ marginRight: 4 }} />
              <Text style={[s.planBadgeText, { color: C.accent }]}>Recommended</Text>
            </View>
            <Text style={[s.planName, { color: C.accent }]}>Premium</Text>
            <View style={s.priceRow}>
              <Text style={s.priceMain}>€4.99</Text>
              <Text style={s.pricePeriod}>/month</Text>
            </View>
            <Text style={s.priceAlt}>or €39.99/year — save 33%</Text>
            <View style={s.featuresBox}>
              {PREMIUM_FEATURES.map(t => <FeatureRow key={t} text={t} accent />)}
            </View>

            {isPremium ? (
              <View style={[s.activeBox]}>
                <Ionicons name="checkmark-circle" size={20} color={C.success} />
                <Text style={[s.activeTxt]}>Premium is active</Text>
              </View>
            ) : (
              <Pressable
                style={[s.ctaBtn, loading && { opacity: 0.6 }]}
                onPress={() => { void handlePurchase(); }}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#0B1220" />
                  : <Text style={s.ctaBtnText}>Get Premium</Text>
                }
              </Pressable>
            )}

            <Pressable
              style={s.restoreBtn}
              onPress={() => { void handleRestore(); }}
              disabled={loading}
            >
              <Text style={s.restoreBtnText}>Restore purchase</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* Dots */}
      <View style={s.dots}>
        {[0, 1].map(i => (
          <Pressable
            key={i}
            style={[s.dot, activeSlide === i && s.dotActive]}
            onPress={() => {
              scrollRef.current?.scrollTo({ x: i * SCREEN_W, animated: true });
            }}
          />
        ))}
      </View>

    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: C.bg },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  backBtn:     { width: 38, height: 38, borderRadius: 19, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: C.text },
  headerSub:   { fontSize: 14, color: C.textSub, textAlign: 'center', marginBottom: 16 },

  slider: { flex: 1 },

  slide: {
    paddingHorizontal: 20,
    justifyContent:    'center',
  },
  planCard: {
    backgroundColor: C.card,
    borderRadius:    24,
    padding:         24,
    gap:             12,
  },
  planCardPremium: {
    borderWidth: 1,
    borderColor: `${C.accent}30`,
  },
  planBadge: {
    flexDirection:    'row',
    alignItems:       'center',
    alignSelf:        'flex-start',
    borderRadius:     20,
    paddingHorizontal: 10,
    paddingVertical:   4,
    backgroundColor:  C.surface2,
    borderWidth:      1,
    borderColor:      C.surface2,
  },
  planBadgeText: { fontSize: 11, fontWeight: '600', color: C.textSub },

  planName: { fontSize: 40, fontWeight: '900', color: C.text },

  priceRow:    { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  priceMain:   { fontSize: 32, fontWeight: '800', color: C.text },
  pricePeriod: { fontSize: 16, color: C.textSub },
  priceAlt:    { fontSize: 13, color: C.textMuted, marginTop: -6 },

  featuresBox: { gap: 2, marginTop: 4 },

  ctaBtn:     { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  ctaBtnText: { fontSize: 16, fontWeight: '700', color: '#0B1220' },

  activeBox: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', marginTop: 8 },
  activeTxt: { fontSize: 15, fontWeight: '600', color: C.success },

  restoreBtn:     { alignItems: 'center', paddingVertical: 10 },
  restoreBtnText: { fontSize: 13, color: C.textMuted },

  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingBottom: 16 },
  dot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: C.surface2 },
  dotActive: { width: 20, backgroundColor: C.accent },
});
