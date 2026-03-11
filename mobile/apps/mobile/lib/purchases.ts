/**
 * purchases.ts — RevenueCat integration layer
 *
 * Architecture:
 *   - Wraps react-native-purchases (RevenueCat SDK)
 *   - Exposes: configure, getOfferings, purchase, restore, checkEntitlement
 *   - Paywall UI: via react-native-purchases-ui (RevenueCat native paywall)
 *   - Customer Center: built-in support screen for subscription management
 *
 * Products configured in RevenueCat dashboard:
 *   - monthly   (monthly subscription)
 *   - yearly    (annual subscription)
 *   - lifetime  (one-time purchase)
 *
 * Entitlement: "premium"
 */

import Purchases, {
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
  LOG_LEVEL,
} from 'react-native-purchases';
import { Platform } from 'react-native';

// ─── Configuration ────────────────────────────────────────────────────────────

const REVENUECAT_API_KEY_IOS = 'test_vsvTpmpWzZtOvqQJXnTCFeFGDSM';

/** Entitlement identifier in RevenueCat dashboard. */
export const PREMIUM_ENTITLEMENT_ID = 'premium';

/** Product identifiers as configured in RevenueCat. */
export const PRODUCT_IDS = {
  monthly:  'monthly',
  yearly:   'yearly',
  lifetime: 'lifetime',
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PurchaseResult {
  ok:     boolean;
  error?: string;
}

export interface OfferingsResult {
  ok:        boolean;
  offering?: PurchasesOffering;
  error?:    string;
}

// ─── Initialisation ───────────────────────────────────────────────────────────

let _configured = false;

/**
 * Configure the RevenueCat SDK.
 * Call once at app startup (in _layout.tsx).
 */
export function configurePurchases(): void {
  if (_configured) return;
  try {
    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }
    if (Platform.OS === 'ios') {
      Purchases.configure({ apiKey: REVENUECAT_API_KEY_IOS });
      _configured = true;
    }
    // Android: add REVENUECAT_API_KEY_ANDROID when needed
  } catch (e) {
    console.error('[purchases] Failed to configure RevenueCat:', e);
  }
}

/**
 * Identify a logged-in user with RevenueCat.
 * Call after Supabase login so purchase history follows the user across devices.
 */
export async function identifyUser(userId: string): Promise<void> {
  if (!_configured) return;
  try {
    await Purchases.logIn(userId);
  } catch {
    // Non-critical — anonymous purchases still work
  }
}

/**
 * Reset RevenueCat user identity on logout.
 */
export async function resetPurchasesUser(): Promise<void> {
  if (!_configured) return;
  try {
    await Purchases.logOut();
  } catch {
    // Non-critical
  }
}

// ─── Entitlement check ────────────────────────────────────────────────────────

/**
 * Returns true if the user has an active premium entitlement.
 */
export async function hasPremiumEntitlement(): Promise<boolean> {
  if (!_configured) return false;
  try {
    const info: CustomerInfo = await Purchases.getCustomerInfo();
    return info.entitlements.active[PREMIUM_ENTITLEMENT_ID] !== undefined;
  } catch {
    return false;
  }
}

/**
 * Get full CustomerInfo — use for detailed subscription state.
 */
export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (!_configured) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch {
    return null;
  }
}

// ─── Offerings ────────────────────────────────────────────────────────────────

/**
 * Fetch the current RevenueCat offering (default offering).
 */
export async function getCurrentOffering(): Promise<OfferingsResult> {
  if (!_configured) {
    return { ok: false, error: 'RevenueCat not configured' };
  }
  try {
    const offerings = await Purchases.getOfferings();
    const offering  = offerings.current ?? Object.values(offerings.all)[0];
    if (!offering) {
      return { ok: false, error: 'No offerings available' };
    }
    return { ok: true, offering };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Failed to load offerings' };
  }
}

// ─── Purchase ─────────────────────────────────────────────────────────────────

/**
 * Purchase a specific package.
 */
export async function purchasePackage(pkg: PurchasesPackage): Promise<PurchaseResult> {
  if (!_configured) {
    return { ok: false, error: 'RevenueCat not configured' };
  }
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const active = customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID] !== undefined;
    return { ok: active, error: active ? undefined : 'Entitlement not active after purchase' };
  } catch (e: unknown) {
    if (
      typeof e === 'object' && e !== null &&
      'userCancelled' in e &&
      (e as { userCancelled: boolean }).userCancelled
    ) {
      return { ok: false, error: 'cancelled' };
    }
    return { ok: false, error: e instanceof Error ? e.message : 'Purchase failed' };
  }
}

// ─── Restore ──────────────────────────────────────────────────────────────────

/**
 * Restore previous purchases.
 * Required by App Store guidelines — must be accessible in the UI.
 */
export async function restorePurchases(): Promise<PurchaseResult> {
  if (!_configured) {
    return { ok: false, error: 'RevenueCat not configured' };
  }
  try {
    const info  = await Purchases.restorePurchases();
    const active = info.entitlements.active[PREMIUM_ENTITLEMENT_ID] !== undefined;
    return { ok: active, error: active ? undefined : 'No active subscription found' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Restore failed' };
  }
}
