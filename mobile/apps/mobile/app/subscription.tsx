/**
 * subscription.tsx — Revolut/Netflix-style horizontal snap pager
 *
 * 3 slides: Free · Premium Monthly · Premium Yearly
 * Cards peek (~88% width), snap to center, scale+opacity focus animation.
 * Starts on slide 1 (Premium Monthly).
 */

import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Animated,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter }    from 'expo-router';
import { Ionicons }     from '@expo/vector-icons';
import { purchasePackage, restorePurchases, getCurrentOffering } from '../lib/purchases';
import { usePremiumGate } from '../lib/use-premium-gate';
import { HapticsLight }   from '../utils/haptics';

// ─── Layout ───────────────────────────────────────────────────────────────────
const { width: SW } = Dimensions.get('window');
const CARD_W  = SW * 0.82;          // 82 % — adjacent card peek
const GAP     = 14;
const SNAP    = CARD_W + GAP;
const INSET   = (SW - CARD_W) / 2;  // center first card

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:       '#0B1220',
  card:     '#1A2436',
  cardPrem: '#0E1E35',
  surface2: '#243046',
  accent:   '#F5A623',
  blue:     '#4DA3FF',
  text:     '#E6EDF7',
  textSub:  '#9FB0C5',
  muted:    '#6B7F99',
  success:  '#3DDC97',
  border:   'rgba(255,255,255,0.07)',
};

// ─── Slide data ───────────────────────────────────────────────────────────────
const SLIDES = [
  { id: 'free' },
  { id: 'monthly' },
  { id: 'yearly' },
] as const;
type SlideId = typeof SLIDES[number]['id'];

const FREE_FEATURES = [
  { icon: 'moon-outline',        text: 'Sleep planning'   },
  { icon: 'chatbubble-outline',  text: 'R-Lo coaching'    },
  { icon: 'sync-outline',        text: 'Cycle tracking'   },
];
const PREMIUM_FEATURES = [
  { icon: 'analytics-outline',      text: 'Understand your sleep cycles' },
  { icon: 'trending-up-outline',    text: 'Weekly recovery insights'     },
  { icon: 'airplane-outline',       text: 'Recover faster from jet lag'  },
  { icon: 'calendar-outline',       text: 'Auto-adapt your schedule'     },
  { icon: 'battery-charging-outline', text: 'Fatigue analysis'           },
  { icon: 'checkmark-circle-outline', text: 'Everything in Free'         },
];

// ─── Feature row ─────────────────────────────────────────────────────────────
function FRow({ icon, text, premium }: { icon: string; text: string; premium?: boolean }) {
  return (
    <View style={fr.row}>
      <Ionicons name={icon as any} size={14} color={premium ? C.blue : C.success} />
      <Text style={[fr.text, { color: premium ? C.text : C.textSub }]}>{text}</Text>
    </View>
  );
}
const fr = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  text: { fontSize: 14, flex: 1, lineHeight: 20 },
});

// ─── Card: Free ───────────────────────────────────────────────────────────────
function FreeCard() {
  return (
    <View style={cd.card}>
      <View style={cd.badgeFree}><Text style={cd.badgeFreeText}>Free plan</Text></View>
      <Text style={cd.planName}>Free</Text>
      <Text style={cd.freePrice}>Always free</Text>
      <View style={cd.divider} />
      <View style={cd.features}>
        {FREE_FEATURES.map(f => <FRow key={f.text} icon={f.icon} text={f.text} />)}
      </View>
    </View>
  );
}

// ─── Card: Premium ────────────────────────────────────────────────────────────
function PremiumCard({
  type, isPremium, loading, onPurchase,
}: {
  type: 'monthly' | 'yearly';
  isPremium: boolean;
  loading: boolean;
  onPurchase: (type: 'monthly' | 'yearly') => void;
}) {
  const isYearly = type === 'yearly';
  return (
    <View style={cd.cardPrem}>
      {/* Badge */}
      <View style={cd.badgePrem}>
        <Ionicons name={isYearly ? 'ribbon-outline' : 'star-outline'} size={11} color={C.accent} />
        <Text style={cd.badgePremText}>{isYearly ? 'Best value' : 'Most popular'}</Text>
      </View>

      <Text style={[cd.planName, { color: C.blue }]}>Premium</Text>

      {/* Price */}
      <View style={cd.priceBlock}>
        {isYearly ? (
          <>
            <View style={cd.priceRow}>
              <Text style={cd.priceMain}>$3.25</Text>
              <Text style={cd.pricePeriod}> / month</Text>
            </View>
            <Text style={cd.priceSub}>$39 / year  ·  Save 33%</Text>
          </>
        ) : (
          <>
            <View style={cd.priceRow}>
              <Text style={cd.priceMain}>$4.99</Text>
              <Text style={cd.pricePeriod}> / month</Text>
            </View>
            <Text style={cd.priceSub}>Billed monthly</Text>
          </>
        )}
      </View>

      <View style={cd.divider} />

      <View style={cd.features}>
        {PREMIUM_FEATURES.map(f => <FRow key={f.text} icon={f.icon} text={f.text} premium />)}
      </View>

      {isPremium ? (
        <View style={cd.activeRow}>
          <Ionicons name="checkmark-circle" size={18} color={C.success} />
          <Text style={cd.activeTxt}>Premium active</Text>
        </View>
      ) : (
        <Pressable
          style={[cd.cta, loading && { opacity: 0.6 }]}
          onPress={() => onPurchase(type)}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#0B1220" size="small" />
            : <Text style={cd.ctaTxt}>Start Premium</Text>
          }
        </Pressable>
      )}
    </View>
  );
}

// ─── Card styles (shared base) ────────────────────────────────────────────────
const CARD_H_MIN = 480;
const cd = StyleSheet.create({
  card: {
    width:           CARD_W,
    minHeight:       CARD_H_MIN,
    backgroundColor: C.card,
    borderRadius:    24,
    padding:         24,
    borderWidth:     1,
    borderColor:     C.border,
  },
  cardPrem: {
    width:           CARD_W,
    minHeight:       CARD_H_MIN,
    backgroundColor: C.cardPrem,
    borderRadius:    24,
    padding:         24,
    borderWidth:     1.5,
    borderColor:     `${C.blue}35`,
  },
  badgeFree:     { alignSelf: 'flex-start', backgroundColor: C.surface2, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 12 },
  badgeFreeText: { fontSize: 11, fontWeight: '600', color: C.muted },
  badgePrem:     { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: `${C.accent}18`, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 12, borderWidth: 1, borderColor: `${C.accent}35` },
  badgePremText: { fontSize: 11, fontWeight: '700', color: C.accent },
  planName:      { fontSize: 28, fontWeight: '900', color: C.text, marginBottom: 4 },
  freePrice:     { fontSize: 15, color: C.muted, marginBottom: 14 },
  priceBlock:    { marginBottom: 16 },
  priceRow:      { flexDirection: 'row', alignItems: 'baseline' },
  priceMain:     { fontSize: 36, fontWeight: '900', color: C.text },
  pricePeriod:   { fontSize: 15, color: C.textSub, fontWeight: '500' },
  priceSub:      { fontSize: 12, color: C.muted, marginTop: 4 },
  divider:       { height: 1, backgroundColor: C.border, marginBottom: 16 },
  features:      { gap: 0, flex: 1 },
  activeRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', paddingTop: 20 },
  activeTxt:     { fontSize: 14, fontWeight: '600', color: C.success },
  cta:           { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 20 },
  ctaTxt:        { fontSize: 16, fontWeight: '700', color: '#0B1220' },
});

// ─── Pagination dots ──────────────────────────────────────────────────────────
function Dots({ scrollX }: { scrollX: Animated.Value }) {
  return (
    <View style={dt.row}>
      {SLIDES.map((_, i) => {
        const inputRange = [(i - 1) * SNAP, i * SNAP, (i + 1) * SNAP];
        const width = scrollX.interpolate({ inputRange, outputRange: [6, 20, 6], extrapolate: 'clamp' });
        const opacity = scrollX.interpolate({ inputRange, outputRange: [0.4, 1, 0.4], extrapolate: 'clamp' });
        const bg = i === 0
          ? C.textSub    // free = grey
          : C.accent;    // premium = orange
        return (
          <Animated.View key={i} style={[dt.dot, { width, opacity, backgroundColor: bg }]} />
        );
      })}
    </View>
  );
}
const dt = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 16 },
  dot: { height: 6, borderRadius: 3 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function SubscriptionScreen() {
  const router                         = useRouter();
  const { isPremium, refresh }         = usePremiumGate();
  const [loading, setLoading]          = useState(false);
  const scrollRef                      = useRef<ScrollView>(null);
  const scrollX                        = useRef(new Animated.Value(SNAP)).current; // start on slide 1

  // Start on Premium Monthly (index 1)
  const onReady = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ x: SNAP, animated: false });
    }, 30);
  }, []);

  // ── Purchase ─────────────────────────────────────────────────────────────
  async function handlePurchase(type: 'monthly' | 'yearly') {
    HapticsLight();
    setLoading(true);
    try {
      const { offering } = await getCurrentOffering();
      const pkgType = type === 'yearly' ? 'ANNUAL' : 'MONTHLY';
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
      Alert.alert('Error', 'Could not restore. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Slide render ─────────────────────────────────────────────────────────
  function renderSlide(id: SlideId, index: number) {
    const inputRange = [(index - 1) * SNAP, index * SNAP, (index + 1) * SNAP];
    const scale   = scrollX.interpolate({ inputRange, outputRange: [0.95, 1, 0.95], extrapolate: 'clamp' });
    const opacity = scrollX.interpolate({ inputRange, outputRange: [0.72, 1, 0.72], extrapolate: 'clamp' });

    return (
      <Animated.View key={id} style={[sl.wrapper, { transform: [{ scale }], opacity }]}>
        {id === 'free'    && <FreeCard />}
        {id === 'monthly' && (
          <PremiumCard type="monthly" isPremium={isPremium} loading={loading} onPurchase={handlePurchase} />
        )}
        {id === 'yearly'  && (
          <PremiumCard type="yearly"  isPremium={isPremium} loading={loading} onPurchase={handlePurchase} />
        )}
      </Animated.View>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>

      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={C.textSub} />
        </Pressable>
      </View>

      {/* Title */}
      <Text style={s.title}>Upgrade your{'\n'}sleep recovery</Text>
      <Text style={s.sub}>Swipe to compare plans</Text>

      {/* Snap pager */}
      <Animated.ScrollView
        ref={scrollRef as any}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={SNAP}
        decelerationRate="fast"
        contentContainerStyle={[sl.container, { paddingHorizontal: INSET }]}
        onLayout={onReady}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false },
        )}
        style={s.pager}
      >
        {SLIDES.map(({ id }, i) => renderSlide(id, i))}
      </Animated.ScrollView>

      {/* Pagination dots */}
      <Dots scrollX={scrollX} />

      {/* Restore */}
      <Pressable style={s.restoreBtn} onPress={() => { void handleRestore(); }} disabled={loading}>
        <Text style={s.restoreTxt}>Restore purchase</Text>
      </Pressable>

    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const sl = StyleSheet.create({
  container: { gap: GAP, alignItems: 'flex-start' },
  wrapper:   { /* scale/opacity applied inline */ },
});

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: C.bg },
  header:     { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  backBtn:    { width: 38, height: 38, borderRadius: 19, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  title:      { fontSize: 30, fontWeight: '900', color: C.text, lineHeight: 36, paddingHorizontal: 16, marginTop: 16, marginBottom: 6 },
  sub:        { fontSize: 13, color: C.muted, paddingHorizontal: 16, marginBottom: 20 },
  pager:      { flexGrow: 0 },
  restoreBtn: { alignItems: 'center', paddingVertical: 12 },
  restoreTxt: { fontSize: 13, color: C.muted },
});
