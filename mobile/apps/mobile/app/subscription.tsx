/**
 * Subscription screen — /subscription
 *
 * Displays current plan + available offerings.
 * Handles purchase flow and restore.
 *
 * Note: Until RevenueCat is configured (REVENUECAT_API_KEY_IOS set),
 * this screen shows a "coming soon" state gracefully.
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import type { PurchasesPackage } from 'react-native-purchases';
import {
  getCurrentOffering,
  purchasePackage,
  restorePurchases,
  hasPremiumEntitlement,
} from '../lib/purchases';

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SubscriptionScreen() {
  const router = useRouter();

  const [isPremium,  setIsPremium]  = useState(false);
  const [packages,   setPackages]   = useState<PurchasesPackage[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null); // package identifier
  const [restoring,  setRestoring]  = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [premium, offerings] = await Promise.all([
        hasPremiumEntitlement(),
        getCurrentOffering(),
      ]);
      setIsPremium(premium);
      if (offerings.ok && offerings.offering) {
        setPackages(offerings.offering.availablePackages);
      }
    } catch {
      setError('Could not load subscription options. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handlePurchase(pkg: PurchasesPackage) {
    setPurchasing(pkg.identifier);
    try {
      const result = await purchasePackage(pkg);
      if (result.ok) {
        setIsPremium(true);
        Alert.alert('Welcome to Premium', 'Your subscription is now active.');
        router.back();
      } else if (result.error !== 'cancelled') {
        Alert.alert('Purchase failed', result.error ?? 'Something went wrong. Please try again.');
      }
    } finally {
      setPurchasing(null);
    }
  }

  async function handleRestore() {
    setRestoring(true);
    try {
      const result = await restorePurchases();
      if (result.ok) {
        setIsPremium(true);
        Alert.alert('Restored', 'Your premium subscription has been restored.');
        router.back();
      } else {
        Alert.alert('No subscription found', result.error ?? 'No active subscription to restore.');
      }
    } finally {
      setRestoring(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={s.scroll}>

        {/* Header */}
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.closeBtn} hitSlop={12}>
            <Text style={s.closeBtnText}>✕</Text>
          </Pressable>
          <Text style={s.title}>Airloop Premium</Text>
          <Text style={s.subtitle}>
            Unlock unlimited conflict resolution, late-event protocol, and full weekly tracking.
          </Text>
        </View>

        {/* Already premium */}
        {isPremium && (
          <View style={s.premiumBadge}>
            <Text style={s.premiumBadgeText}>✓  Premium active</Text>
          </View>
        )}

        {/* Loading */}
        {loading && (
          <ActivityIndicator color="#22C55E" style={s.loader} />
        )}

        {/* Error */}
        {!loading && error && (
          <View style={s.errorBlock}>
            <Text style={s.errorText}>{error}</Text>
            <Pressable style={s.retryBtn} onPress={load}>
              <Text style={s.retryBtnText}>Try again</Text>
            </Pressable>
          </View>
        )}

        {/* Not configured yet */}
        {!loading && !error && packages.length === 0 && !isPremium && (
          <View style={s.comingSoon}>
            <Text style={s.comingSoonText}>Subscriptions coming soon.</Text>
            <Text style={s.comingSoonSub}>In-app purchase will be available in the next build.</Text>
          </View>
        )}

        {/* Packages */}
        {!loading && packages.map(pkg => {
          const isBuying = purchasing === pkg.identifier;
          return (
            <Pressable
              key={pkg.identifier}
              style={({ pressed }) => [s.packageCard, pressed && s.packageCardPressed]}
              onPress={() => { void handlePurchase(pkg); }}
              disabled={!!purchasing || isPremium}
            >
              <View style={s.packageInfo}>
                <Text style={s.packageTitle}>{pkg.product.title}</Text>
                <Text style={s.packagePrice}>
                  {pkg.product.priceString} / {pkg.packageType === 'ANNUAL' ? 'year' : 'month'}
                </Text>
                {pkg.packageType === 'ANNUAL' && (
                  <Text style={s.packageSavings}>Best value — save ~40%</Text>
                )}
              </View>
              {isBuying ? (
                <ActivityIndicator color="#22C55E" />
              ) : (
                <Text style={s.packageCta}>{isPremium ? 'Active' : 'Subscribe'}</Text>
              )}
            </Pressable>
          );
        })}

        {/* Restore */}
        {!isPremium && (
          <Pressable
            style={s.restoreBtn}
            onPress={() => { void handleRestore(); }}
            disabled={restoring}
          >
            {restoring
              ? <ActivityIndicator color="rgba(255,255,255,0.45)" size="small" />
              : <Text style={s.restoreBtnText}>Restore purchases</Text>
            }
          </Pressable>
        )}

        {/* Legal */}
        <Text style={s.legal}>
          Subscription renews automatically. Cancel anytime in App Store settings.
          Payment charged to your Apple ID account at confirmation of purchase.
        </Text>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: '#0A0A0A',
  },
  scroll: {
    padding:       24,
    paddingBottom: 48,
  },
  header: {
    marginBottom: 32,
  },
  closeBtn: {
    alignSelf:    'flex-start',
    marginBottom: 20,
  },
  closeBtnText: {
    color:    'rgba(255,255,255,0.55)',
    fontSize: 20,
  },
  title: {
    color:         '#FFFFFF',
    fontSize:      32,
    fontWeight:    '700',
    letterSpacing: -0.5,
    marginBottom:  10,
  },
  subtitle: {
    color:      'rgba(255,255,255,0.55)',
    fontSize:   16,
    lineHeight: 24,
  },
  premiumBadge: {
    backgroundColor: '#052E16',
    borderRadius:    12,
    paddingVertical: 14,
    alignItems:      'center',
    marginBottom:    20,
    borderWidth:     1,
    borderColor:     '#22C55E',
  },
  premiumBadgeText: {
    color:      '#22C55E',
    fontSize:   16,
    fontWeight: '600',
  },
  loader: {
    marginVertical: 40,
  },
  errorBlock: {
    alignItems:    'center',
    gap:           16,
    marginVertical: 32,
  },
  errorText: {
    color:     'rgba(255,255,255,0.55)',
    fontSize:  15,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 24,
    paddingVertical:   12,
    borderRadius:      10,
  },
  retryBtnText: {
    color:      '#FFFFFF',
    fontWeight: '600',
  },
  comingSoon: {
    alignItems:    'center',
    marginVertical: 48,
    gap:           10,
  },
  comingSoonText: {
    color:      '#FFFFFF',
    fontSize:   18,
    fontWeight: '600',
  },
  comingSoonSub: {
    color:      'rgba(255,255,255,0.45)',
    fontSize:   14,
    textAlign:  'center',
  },
  packageCard: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: '#1A1A1A',
    borderRadius:    16,
    padding:         20,
    marginBottom:    12,
    borderWidth:     1,
    borderColor:     '#2A2A2A',
  },
  packageCardPressed: {
    opacity: 0.75,
  },
  packageInfo: {
    flex: 1,
  },
  packageTitle: {
    color:        '#FFFFFF',
    fontSize:     17,
    fontWeight:   '600',
    marginBottom: 4,
  },
  packagePrice: {
    color:      'rgba(255,255,255,0.65)',
    fontSize:   14,
    marginBottom: 2,
  },
  packageSavings: {
    color:    '#22C55E',
    fontSize: 12,
    fontWeight: '500',
  },
  packageCta: {
    color:      '#22C55E',
    fontSize:   15,
    fontWeight: '700',
  },
  restoreBtn: {
    alignItems:    'center',
    paddingVertical: 16,
    marginBottom:  8,
  },
  restoreBtnText: {
    color:    'rgba(255,255,255,0.45)',
    fontSize: 14,
  },
  legal: {
    color:      'rgba(255,255,255,0.25)',
    fontSize:   11,
    lineHeight: 18,
    textAlign:  'center',
    marginTop:  8,
  },
});
