/**
 * subscription.tsx — Premium subscription screen
 *
 * Uses the RevenueCat native Paywall UI for displaying offerings.
 * Falls back to a manual offerings list if the paywall is unavailable.
 *
 * Includes:
 *   - RevenueCat Paywall (react-native-purchases-ui)
 *   - Restore purchases button
 *   - Customer Center (manage subscription / cancel / refunds)
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import type { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import {
  getCurrentOffering,
  purchasePackage,
  restorePurchases,
  hasPremiumEntitlement,
  PREMIUM_ENTITLEMENT_ID,
} from '../lib/purchases';

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function SubscriptionScreen() {
  const router = useRouter();
  const [isPremium, setIsPremium] = useState(false);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    hasPremiumEntitlement().then(active => {
      setIsPremium(active);
      setLoading(false);
    });
  }, []);

  // ── Present RevenueCat native paywall ─────────────────────────────────────

  async function presentPaywall() {
    try {
      const result = await RevenueCatUI.presentPaywall();
      switch (result) {
        case PAYWALL_RESULT.PURCHASED:
        case PAYWALL_RESULT.RESTORED:
          setIsPremium(true);
          Alert.alert('Welcome to Premium', 'Your subscription is now active.');
          break;
        case PAYWALL_RESULT.ERROR:
          Alert.alert('Error', 'Something went wrong. Please try again.');
          break;
        // CANCELLED — no action needed
      }
    } catch {
      // Paywall not available — fall through to manual offering below
      setShowFallback(true);
    }
  }

  // ── Customer Center (manage / cancel / refunds) ───────────────────────────

  async function presentCustomerCenter() {
    try {
      await RevenueCatUI.presentCustomerCenter();
      // Re-check entitlement after customer center closes
      const active = await hasPremiumEntitlement();
      setIsPremium(active);
    } catch {
      Alert.alert(
        'Manage Subscription',
        'Go to iPhone Settings → Apple ID → Subscriptions to manage your plan.',
      );
    }
  }

  // ── Restore ──────────────────────────────────────────────────────────────

  async function handleRestore() {
    setLoading(true);
    const result = await restorePurchases();
    setLoading(false);
    if (result.ok) {
      setIsPremium(true);
      Alert.alert('Restored', 'Your subscription has been restored.');
    } else if (result.error !== 'No active subscription found') {
      Alert.alert('Restore failed', result.error ?? 'Please try again.');
    } else {
      Alert.alert('Nothing to restore', 'No active subscription found on this Apple ID.');
    }
  }

  // ── Fallback manual offering ──────────────────────────────────────────────

  const [showFallback, setShowFallback] = useState(false);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color="#22C55E" size="large" />
      </View>
    );
  }

  if (isPremium) {
    return <PremiumActiveScreen onManage={presentCustomerCenter} onBack={() => router.back()} />;
  }

  if (showFallback) {
    return (
      <FallbackOfferingsScreen
        onSuccess={() => setIsPremium(true)}
        onRestore={handleRestore}
        onBack={() => router.back()}
      />
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        {/* Header */}
        <Pressable style={s.closeBtn} onPress={() => router.back()}>
          <Text style={s.closeBtnText}>✕</Text>
        </Pressable>

        <Text style={s.title}>R90 Navigator Premium</Text>
        <Text style={s.subtitle}>
          Full access to personalised sleep coaching, advanced analytics, and priority support.
        </Text>

        {/* Present RevenueCat native paywall */}
        <Pressable style={s.primaryBtn} onPress={() => { void presentPaywall(); }}>
          <Text style={s.primaryBtnText}>View plans</Text>
        </Pressable>

        {/* Restore */}
        <Pressable style={s.secondaryBtn} onPress={() => { void handleRestore(); }}>
          <Text style={s.secondaryBtnText}>Restore purchases</Text>
        </Pressable>

        <Text style={s.legal}>
          Subscriptions auto-renew unless cancelled at least 24 hours before the end of the current period. Manage in Settings → Apple ID → Subscriptions.
        </Text>
      </View>
    </SafeAreaView>
  );
}

// ─── Premium active screen ────────────────────────────────────────────────────

function PremiumActiveScreen({
  onManage,
  onBack,
}: {
  onManage: () => void;
  onBack:   () => void;
}) {
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <Pressable style={s.closeBtn} onPress={onBack}>
          <Text style={s.closeBtnText}>✕</Text>
        </Pressable>

        <View style={s.activeIcon}>
          <Text style={s.activeIconText}>✓</Text>
        </View>
        <Text style={s.title}>Premium active</Text>
        <Text style={s.subtitle}>
          You have full access to R90 Navigator Premium.
        </Text>

        <Pressable style={s.primaryBtn} onPress={onManage}>
          <Text style={s.primaryBtnText}>Manage subscription</Text>
        </Pressable>
        <Pressable style={s.secondaryBtn} onPress={onBack}>
          <Text style={s.secondaryBtnText}>Back</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// ─── Fallback offerings screen ────────────────────────────────────────────────

function FallbackOfferingsScreen({
  onSuccess,
  onRestore,
  onBack,
}: {
  onSuccess: () => void;
  onRestore: () => void;
  onBack:    () => void;
}) {
  const [offering,  setOffering]  = useState<PurchasesOffering | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    getCurrentOffering().then(result => {
      if (result.ok && result.offering) setOffering(result.offering);
      setLoading(false);
    });
  }, []);

  async function handlePurchase(pkg: PurchasesPackage) {
    setPurchasing(true);
    const result = await purchasePackage(pkg);
    setPurchasing(false);
    if (result.ok) {
      onSuccess();
    } else if (result.error !== 'cancelled') {
      Alert.alert('Purchase failed', result.error ?? 'Please try again.');
    }
  }

  if (loading) {
    return <View style={s.center}><ActivityIndicator color="#22C55E" /></View>;
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.fallbackContent}>
        <Pressable style={s.closeBtn} onPress={onBack}>
          <Text style={s.closeBtnText}>✕</Text>
        </Pressable>

        <Text style={s.title}>R90 Navigator Premium</Text>

        {offering?.availablePackages.map(pkg => (
          <Pressable
            key={pkg.identifier}
            style={s.packageCard}
            onPress={() => { void handlePurchase(pkg); }}
            disabled={purchasing}
          >
            <Text style={s.packageTitle}>{pkg.product.title}</Text>
            <Text style={s.packagePrice}>{pkg.product.priceString}</Text>
            {pkg.product.description ? (
              <Text style={s.packageDesc}>{pkg.product.description}</Text>
            ) : null}
          </Pressable>
        ))}

        {!offering && (
          <Text style={s.noOfferings}>
            No offerings available. Please check back later.
          </Text>
        )}

        <Pressable style={s.secondaryBtn} onPress={onRestore}>
          <Text style={s.secondaryBtnText}>Restore purchases</Text>
        </Pressable>

        <Text style={s.legal}>
          Subscriptions auto-renew unless cancelled at least 24 hours before the end of the current period.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: '#0D0D0D' },
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0D0D0D' },
  container:      { flex: 1, padding: 24, justifyContent: 'center', gap: 16 },
  fallbackContent:{ padding: 24, paddingBottom: 48, gap: 16 },

  closeBtn:       { position: 'absolute', top: 16, right: 16, padding: 8 },
  closeBtnText:   { color: 'rgba(255,255,255,0.5)', fontSize: 18 },

  activeIcon:     { width: 64, height: 64, borderRadius: 32, backgroundColor: '#22C55E', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  activeIconText: { color: '#000', fontSize: 28, fontWeight: '700' },

  title:          { color: '#FFFFFF', fontSize: 28, fontWeight: '700', textAlign: 'center' },
  subtitle:       { color: '#9CA3AF', fontSize: 15, lineHeight: 22, textAlign: 'center' },

  primaryBtn:         { backgroundColor: '#22C55E', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  primaryBtnText:     { color: '#000000', fontSize: 16, fontWeight: '700' },
  secondaryBtn:       { paddingVertical: 14, alignItems: 'center' },
  secondaryBtnText:   { color: '#6B7280', fontSize: 14 },

  packageCard:    { backgroundColor: '#1A1A1A', borderRadius: 14, padding: 20, borderWidth: 1, borderColor: '#2A2A2A', gap: 4 },
  packageTitle:   { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
  packagePrice:   { color: '#22C55E', fontSize: 22, fontWeight: '700' },
  packageDesc:    { color: '#9CA3AF', fontSize: 13, marginTop: 4 },

  noOfferings:    { color: '#6B7280', textAlign: 'center', fontSize: 14 },
  legal:          { color: '#374151', fontSize: 11, textAlign: 'center', lineHeight: 16, marginTop: 8 },
});
