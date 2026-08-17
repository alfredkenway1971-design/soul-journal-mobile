import { Platform } from "react-native";
import { useSubscriptionStore } from "@/store/subscriptionStore";

/**
 * Play Billing IAP — Soul Journal subscriptions.
 * Product IDs must match the Google Play Console (subscriptions created there:
 * soul_journal_monthly_999 = $9.99/mo, soul_journal_yearly_9599 = $95.99/yr).
 * Web keeps Stripe; mobile uses Play Billing. Both reconcile through the
 * check-subscription edge fn (Phase 3 receipt-verification backend work).
 *
 * ⚠️ CRITICAL: expo-in-app-purchases' native module is NOT present in Expo Go
 * (it exists only in dev/production builds). Static import crashes Expo Go at
 * boot ("Cannot find native module 'ExpoInAppPurchases'"). The module is loaded
 * LAZILY via require() inside functions — never at module top-level.
 */
export const PRODUCT_IDS = {
  monthly: "soul_journal_monthly_999", // $9.99/mo
  yearly: "soul_journal_yearly_9599", // $95.99/yr (Save 20%)
} as const;

type IAPModule = typeof import("expo-in-app-purchases");

let iapModule: IAPModule | null = null;

/** Lazily load the IAP native module. Throws on Expo Go (callers handle it). */
function iap(): IAPModule {
  if (!iapModule) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    iapModule = require("expo-in-app-purchases") as IAPModule;
  }
  return iapModule;
}

let connected = false;
let listenerWired = false;

/** Connect to Play Billing (call once per app session, Android only). */
export async function initBilling(): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  if (connected) return true;
  try {
    await iap().connectAsync();
    connected = true;
    return true;
  } catch (e) {
    console.warn("billing connect error (expected in Expo Go)", e);
    return false;
  }
}

/** Fetch the two subscription products (price, title, description). */
export async function getProducts(): Promise<any[]> {
  try {
    const IAP = iap();
    const res = await IAP.getProductsAsync([PRODUCT_IDS.monthly, PRODUCT_IDS.yearly]);
    if (res.responseCode !== IAP.IAPResponseCode.OK) return [];
    return res.results ?? [];
  } catch (e) {
    console.warn("get products error (expected in Expo Go)", e);
    return [];
  }
}

/**
 * Subscribe to a product. Purchases arrive asynchronously via the listener
 * (set in setupPurchaseListener) — the UI should show a pending state and let
 * the listener unlock premium.
 */
export async function subscribe(sku: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await iap().purchaseItemAsync(sku);
    return { ok: true }; // listener confirms completion
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "purchase failed" };
  }
}

/** Restore previous purchases (Play handles this automatically for subs). */
export async function restorePurchases(): Promise<boolean> {
  try {
    const IAP = iap();
    const res = await IAP.getPurchaseHistoryAsync();
    if (res.responseCode === IAP.IAPResponseCode.OK && res.results?.length) {
      useSubscriptionStore.getState().markPremium();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Wire the global purchase listener (Android builds only — no-op in Expo Go). */
export function setupPurchaseListener() {
  if (Platform.OS !== "android" || listenerWired) return;
  listenerWired = true;
  try {
    const IAP = iap();
    IAP.setPurchaseListener(({ responseCode, results, errorCode }: any) => {
      if (responseCode === IAP.IAPResponseCode.OK && results?.length) {
        results.forEach((p: any) => {
          IAP.finishTransactionAsync(p, false).catch(() => {});
        });
        useSubscriptionStore.getState().markPremium();
      } else if (responseCode === IAP.IAPResponseCode.ERROR && errorCode) {
        console.warn("purchase listener error", errorCode);
      }
    });
  } catch (e) {
    console.warn("purchase listener unavailable (expected in Expo Go)", e);
  }
}
