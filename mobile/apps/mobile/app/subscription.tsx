/**
 * subscription.tsx — Calm-style vertical paywall
 *
 * Sections:
 *   1. Header        — title + subtitle
 *   2. Authority     — Nick Littlehales credential
 *   3. Social proof  — user count + testimonials carousel
 *   4. Benefits      — 4 key outcomes
 *   5. Toggle        — Monthly / Yearly
 *   6. Pricing       — 2 cards (yearly highlighted)
 *   7. Trial timeline— Blinkist-style honest 3-step timeline
 *   8. CTA           — "Start free trial"
 *   9. Footer        — trial + cancel copy
 */

import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  FlatList,
  Switch,
  ActivityIndicator,
  Alert,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter }    from 'expo-router';
import { Ionicons }     from '@expo/vector-icons';
import { purchasePackage, restorePurchases, getCurrentOffering } from '../lib/purchases';
import { usePremiumGate } from '../lib/use-premium-gate';
import { HapticsLight }   from '../utils/haptics';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:      '#0a0a3a',
  card:    '#141466',
  cardHL:  '#0E1E35',
  surface: '#1c1c7a',
  accent:  '#F5A623',
  blue:    '#1c9fda',
  text:    '#E6EDF7',
  sub:     '#9FB0C5',
  muted:   '#6B7F99',
  success: '#3DDC97',
  gold:    '#FBBF24',
  border:  'rgba(255,255,255,0.08)',
};

// ─── Benefits ─────────────────────────────────────────────────────────────────
const BENEFITS = [
  { icon: 'sunny-outline',       text: 'Wake up with more energy every morning'           },
  { icon: 'moon-outline',        text: 'Let AI choose the perfect time to sleep'          },
  { icon: 'trending-up-outline', text: 'Build a stable sleep rhythm automatically'        },
  { icon: 'flash-outline',       text: 'Recover faster from fatigue and jet lag'          },
];

// ─── Testimonials ─────────────────────────────────────────────────────────────
const TESTIMONIALS = [
  {
    quote: 'I finally wake up without an alarm. After 3 months of R90, my body just knows.',
    name:  'Sarah M.',
    role:  'R90 user, 3 months',
    stars: 5,
  },
  {
    quote: 'The cycle approach changed everything. I sleep less but feel way more rested.',
    name:  'James K.',
    role:  'Professional athlete',
    stars: 5,
  },
  {
    quote: 'I was sceptical of sleep apps. This one actually explains the science behind it.',
    name:  'Priya L.',
    role:  'R90 user, 6 weeks',
    stars: 5,
  },
];

// ─── TestimonialsCarousel ─────────────────────────────────────────────────────
function TestimonialsCarousel() {
  const [idx, setIdx] = useState(0);
  const flatRef       = useRef<FlatList>(null);
  const cardW         = SCREEN_W - 48; // 24px padding each side

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const newIdx = Math.round(e.nativeEvent.contentOffset.x / cardW);
      setIdx(newIdx);
    },
    [cardW],
  );

  return (
    <View style={tc.wrap}>
      <FlatList
        ref={flatRef}
        data={TESTIMONIALS}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardW}
        decelerationRate="fast"
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => (
          <View style={[tc.card, { width: cardW }]}>
            {/* Stars */}
            <View style={tc.stars}>
              {Array.from({ length: item.stars }).map((_, i) => (
                <Ionicons key={i} name="star" size={13} color={C.gold} />
              ))}
            </View>
            <Text style={tc.quote}>"{item.quote}"</Text>
            <Text style={tc.name}>— {item.name}</Text>
            <Text style={tc.role}>{item.role}</Text>
          </View>
        )}
      />
      {/* Dots */}
      <View style={tc.dots}>
        {TESTIMONIALS.map((_, i) => (
          <View key={i} style={[tc.dot, i === idx && tc.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const tc = StyleSheet.create({
  wrap:      { marginBottom: 32 },
  card:      { backgroundColor: C.card, borderRadius: 18, padding: 20, gap: 8 },
  stars:     { flexDirection: 'row', gap: 3, marginBottom: 2 },
  quote:     { fontSize: 15, color: C.text, fontStyle: 'italic', lineHeight: 23, fontWeight: '400' },
  name:      { fontSize: 14, color: C.sub, fontWeight: '600' },
  role:      { fontSize: 12, color: C.muted },
  dots:      { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 12 },
  dot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: C.surface },
  dotActive: { backgroundColor: C.blue, width: 18 },
});

// ─── TrialTimeline ────────────────────────────────────────────────────────────
function TrialTimeline({ price, yearly }: { price: string; yearly: boolean }) {
  const steps = [
    {
      day:   'Today',
      icon:  'checkmark-circle',
      color: C.success,
      label: 'Free trial starts',
      sub:   'Full access — no charge',
    },
    {
      day:   yearly ? 'Day 5' : 'Day 5',
      icon:  'notifications',
      color: C.blue,
      label: "We'll remind you",
      sub:   '2 days before your trial ends',
    },
    {
      day:   'Day 7',
      icon:  'card',
      color: C.accent,
      label: 'Subscription begins',
      sub:   `${price}${yearly ? '/year' : '/month'} — cancel anytime`,
    },
  ];

  return (
    <View style={tl.wrap}>
      <Text style={tl.heading}>How your trial works</Text>
      {steps.map((step, i) => (
        <View key={step.day} style={tl.row}>
          {/* Left: connector */}
          <View style={tl.leftCol}>
            <View style={[tl.iconCircle, { backgroundColor: `${step.color}20`, borderColor: `${step.color}50` }]}>
              <Ionicons name={step.icon as any} size={18} color={step.color} />
            </View>
            {i < steps.length - 1 && <View style={tl.connector} />}
          </View>
          {/* Right: text */}
          <View style={tl.textCol}>
            <View style={tl.dayRow}>
              <View style={[tl.dayPill, { backgroundColor: `${step.color}15` }]}>
                <Text style={[tl.dayTxt, { color: step.color }]}>{step.day}</Text>
              </View>
            </View>
            <Text style={tl.label}>{step.label}</Text>
            <Text style={tl.sub}>{step.sub}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const tl = StyleSheet.create({
  wrap:       { backgroundColor: C.card, borderRadius: 18, padding: 20, marginBottom: 24 },
  heading:    { fontSize: 14, fontWeight: '700', color: C.sub, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 20 },
  row:        { flexDirection: 'row', gap: 14 },
  leftCol:    { alignItems: 'center', width: 40 },
  iconCircle: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  connector:  { width: 2, flex: 1, backgroundColor: C.border, marginVertical: 4, minHeight: 20 },
  textCol:    { flex: 1, paddingBottom: 20 },
  dayRow:     { marginBottom: 4 },
  dayPill:    { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  dayTxt:     { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  label:      { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 2 },
  sub:        { fontSize: 13, color: C.sub, lineHeight: 18 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function SubscriptionScreen() {
  const router                 = useRouter();
  const { isPremium, refresh } = usePremiumGate();
  const [yearly,  setYearly]   = useState(true);
  const [loading, setLoading]  = useState(false);

  const MONTHLY_PRICE  = '$9.99';
  const YEARLY_TOTAL   = '$79.99';
  const YEARLY_MONTHLY = '$6.66';

  const displayPrice = yearly ? YEARLY_TOTAL : MONTHLY_PRICE;

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

        {/* ── Close ── */}
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.closeBtn}>
          <Ionicons name="close" size={20} color={C.sub} />
        </Pressable>

        {/* ── 1. Header ── */}
        <View style={s.header}>
          <Text style={s.title}>Your sleep plan{'\n'}is ready</Text>
          <Text style={s.subtitle}>Unlock your AI sleep coach</Text>
        </View>

        {/* ── 2. Authority ── */}
        <View style={s.authorityBar}>
          <Ionicons name="ribbon" size={16} color={C.gold} />
          <Text style={s.authorityTxt}>
            Created by <Text style={s.authorityBold}>Nick Littlehales</Text> — sleep coach to Cristiano Ronaldo, Manchester City & Team GB
          </Text>
        </View>

        {/* ── 3. Social proof ── */}
        <View style={s.socialProof}>
          <Ionicons name="people" size={16} color={C.blue} />
          <Text style={s.socialTxt}>Join <Text style={s.socialBold}>10,000+ users</Text> who improved their sleep rhythm</Text>
        </View>

        <TestimonialsCarousel />

        {/* ── 4. Benefits ── */}
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

        {/* ── 5. Toggle ── */}
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

        {/* ── 6. Pricing cards ── */}
        <View style={s.cards}>

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

        {/* ── 7. Trial timeline ── */}
        <TrialTimeline price={displayPrice} yearly={yearly} />

        {/* ── 8. CTA ── */}
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
              ? <ActivityIndicator color="#0a0a3a" />
              : <>
                  <Text style={s.ctaTxt}>Start free trial</Text>
                  <Text style={s.ctaSub}>7 days free — no charge today</Text>
                </>
            }
          </Pressable>
        )}

        {/* ── 9. Footer ── */}
        <Text style={s.footer}>
          {yearly
            ? `Free for 7 days, then ${YEARLY_TOTAL}/year. Cancel anytime before Day 7.`
            : `Free for 7 days, then ${MONTHLY_PRICE}/month. Cancel anytime before Day 7.`}
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
  scroll: { paddingHorizontal: 24, paddingBottom: 40 },

  closeBtn: { alignSelf: 'flex-end', marginTop: 8, padding: 4 },

  // Header
  header:   { marginTop: 12, marginBottom: 24 },
  title:    { fontSize: 32, fontWeight: '900', color: C.text, lineHeight: 40, marginBottom: 10 },
  subtitle: { fontSize: 17, color: C.sub, lineHeight: 24 },

  // Authority bar
  authorityBar:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: `${C.gold}10`, borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: `${C.gold}25` },
  authorityTxt:  { flex: 1, fontSize: 13, color: C.sub, lineHeight: 19 },
  authorityBold: { color: C.gold, fontWeight: '700' },

  // Social proof
  socialProof: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 16 },
  socialTxt:   { fontSize: 14, color: C.sub },
  socialBold:  { color: C.text, fontWeight: '700' },

  // Benefits
  benefits:    { gap: 16, marginBottom: 32 },
  benefitRow:  { flexDirection: 'row', alignItems: 'center', gap: 14 },
  benefitIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: `${C.blue}15`, alignItems: 'center', justifyContent: 'center' },
  benefitText: { fontSize: 16, color: C.text, fontWeight: '500', flex: 1, lineHeight: 22 },

  // Toggle
  toggleRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 20 },
  toggleLabel:       { fontSize: 15, color: C.muted, fontWeight: '500' },
  toggleLabelActive: { color: C.text, fontWeight: '700' },
  switch:            { transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] },
  savePill:          { backgroundColor: `${C.success}20`, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: `${C.success}40` },
  savePillText:      { fontSize: 11, fontWeight: '700', color: C.success },

  // Cards
  cards:           { flexDirection: 'row', gap: 12, marginBottom: 24 },
  card:            { flex: 1, backgroundColor: C.card, borderRadius: 18, padding: 18, borderWidth: 2, borderColor: 'transparent', gap: 6 },
  cardYearly:      { backgroundColor: C.cardHL },
  cardSelected:    { borderColor: C.blue },
  cardTop:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  planName:        { fontSize: 16, fontWeight: '700', color: C.text },
  planPrice:       { fontSize: 26, fontWeight: '900', color: C.text },
  planPer:         { fontSize: 14, fontWeight: '500', color: C.sub },
  planYearlyTotal: { fontSize: 13, color: C.muted, marginTop: -2 },
  planNote:        { fontSize: 12, color: C.muted, marginTop: 2 },
  selectedDot:     { width: 10, height: 10, borderRadius: 5, backgroundColor: C.blue },
  bestBadge:       { backgroundColor: `${C.blue}20`, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: `${C.blue}40` },
  bestBadgeText:   { fontSize: 10, fontWeight: '700', color: C.blue },

  // CTA
  cta:    { backgroundColor: C.accent, borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginBottom: 16, gap: 3 },
  ctaTxt: { fontSize: 17, fontWeight: '800', color: '#0a0a3a', letterSpacing: 0.2 },
  ctaSub: { fontSize: 12, fontWeight: '600', color: '#0a0a3a', opacity: 0.7 },

  activeBox: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', paddingVertical: 18, marginBottom: 16 },
  activeTxt: { fontSize: 15, fontWeight: '600', color: C.success },

  // Footer
  footer:     { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  restoreBtn: { alignItems: 'center', paddingVertical: 8 },
  restoreTxt: { fontSize: 13, color: C.muted },
});
