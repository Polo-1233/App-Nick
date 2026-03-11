/**
 * purchases.ts — RevenueCat integration layer
 *
 * Architecture:
 *   - Wraps react-native-purchases (RevenueCat SDK)
 *   - Exposes: configure, getOfferings, purchase, restore, checkEntitlement
 *   - All calls are safe — errors are caught and surfaced as typed results
 *
 * Setup checklist (Thomas):
 *   1. Create app in RevenueCat dashboard (https://app.revenuecat.com)
 *   2. Add products in App Store Connect:
 *        - airloop_premium_monthly  (subscription, 1 month)
 *        - airloop_premium_annual   (subscription, 1 year)
 *   3. Create entitlement in RevenueCat: "premium"
 *   4. Attach both products to the "premium" entitlement
 *   5. Replace REVENUECAT_API_KEY_IOS below with your iOS API key
 *   6. Rebuild dev client: eas build --profile development --platform ios
 *
 * Until the API key is set, all purchase calls return { ok: false } gracefully.
 */

import Purchases, {
  type CustomerInfo,
  type PurchasesOffering,
  LOG_LEVEL,
} from 'react-native-purchases';
import { Platform } from 'react-native';

// ─── Configuration ────────────────────────────────────────────────────────────

/** Replace with your RevenueCat iOS API key from the dashboard. */
const REVENUECAT_API_KEY_IOS = 'TODO_REVENUECAT_API_KEY_IOS';

/** The entitlement identifier configured in the RevenueCat dashboard. */
export const PREMIUM_ENTITLEMENT_ID = 'premium';

/** Product identifiers as configured in App Store Connect + RevenueCat. */
export const PRODUCT_IDS = {
  monthly: 'airloop_premium_monthly',
  annual:  'airloop_premium_annual',
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PurchaseResult {
  ok:    boolean;
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
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export function configurePurchases(): void {
  if (_configured) return;
  if (REVENUECAT_API_KEY_IOS === 'TODO_REVENUECAT_API_KEY_IOS') {
    // Not yet configured — skip gracefully in dev
    return;
  }
  try {
    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }
    if (Platform.OS === 'ios') {
      Purchases.configure({ apiKey: REVENUECAT_API_KEY_IOS });
      _configured = true;
    }
    // Android: add REVENUECAT_API_KEY_ANDROID + configure for Platform.OS === 'android' when needed
  } catch (e) {
    console.error('[purchases] Failed to configure RevenueCat:', e);
  }
}

// ─── Customer info / entitlement ──────────────────────────────────────────────

/**
 * Returns true if the user has an active premium entitlement.
 * Returns false on error or when RevenueCat is not configured.
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

// ─── Offerings ────────────────────────────────────────────────────────────────

/**
 * Fetch the current RevenueCat offering.
 * Returns the "default" offering, or the first available one.
 */
export async function getCurrentOffering(): Promise<OfferingsResult> {
  if (!_configured) {
    return { ok: false, error: 'RevenueCat not configured' };
  }
  try {
    const offerings = await Purchases.getOfferings();
    const offering = offerings.current ?? Object.values(offerings.all)[0];
    if (!offering) {
      return { ok: false, error: 'No offerings available' };
    }
    return { ok: true, offering };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to load offerings';
    return { ok: false, error: msg };
  }
}

// ─── Purchase ─────────────────────────────────────────────────────────────────

/**
 * Purchase a specific package from the current offering.
 * Returns ok: true if the purchase was successful and entitlement is active.
 */
export async function purchasePackage(
  pkg: import('react-native-purchases').PurchasesPackage
): Promise<PurchaseResult> {
  if (!_configured) {
    return { ok: false, error: 'RevenueCat not configured' };
  }
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const active = customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID] !== undefined;
    return { ok: active, error: active ? undefined : 'Entitlement not active after purchase' };
  } catch (e: unknown) {
    // User cancelled — not an error worth surfacing as error
    if (typeof e === 'object' && e !== null && 'userCancelled' in e && (e as { userCancelled: boolean }).userCancelled) {
      return { ok: false, error: 'cancelled' };
    }
    const msg = e instanceof Error ? e.message : 'Purchase failed';
    return { ok: false, error: msg };
  }
}

// ─── Restore ──────────────────────────────────────────────────────────────────

/**
 * Restore previous purchases (required by App Store guidelines).
 * Returns ok: true if an active premium entitlement was found.
 */
export async function restorePurchases(): Promise<PurchaseResult> {
  if (!_configured) {
    return { ok: false, error: 'RevenueCat not configured' };
  }
  try {
    const info = await Purchases.restorePurchases();
    const active = info.entitlements.active[PREMIUM_ENTITLEMENT_ID] !== undefined;
    return { ok: active, error: active ? undefined : 'No active subscription found' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Restore failed';
    return { ok: false, error: msg };
  }
}
