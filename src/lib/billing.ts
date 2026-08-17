import * as IAP from "expo-in-app-purchases";
import { Platform } from "react-native";
import { useSubscriptionStore } from "@/store/subscriptionStore";

/**
 * Play Billing IAP — Soul Journal subscriptions.
 * Product IDs must match the Google Play Console (subscriptions created there:
 * soul_journal_monthly_999 = $9.99/mo, soul_journal_yearly_9599 = $95.99/yr).
 * Web keeps Stripe; mobile uses Play Billing. Both reconcile through the
 * check-subscription edge fn (Phase 3 receipt-verification backend work).
 */
export const PRODUCT_IDS = {
  monthly: "soul_journal_monthly_999", // $9.99/mo
  yearly: "soul_journal_yearly_9599", // $95.99/yr (Save 20%)
} as const;

let connected = false;
let listenerWired = false;

/** Connect to Play Billing (call once per app session, Android only). */
export async function initBilling(): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  if (connected) return true;
  try {
    await IAP.connectAsync();
    connected = true;
    return true;
  } catch (e) {
    console.warn("billing connect error", e);
    return false;
  }
}

/** Fetch the two subscription products (price, title, description). */
export async function getProducts(): Promise<IAP.IAPItemDetails[]> {
  try {
    const res = await IAP.getProductsAsync([PRODUCT_IDS.monthly, PRODUCT_IDS.yearly]);
    if (res.responseCode !== IAP.IAPResponseCode.OK) return [];
    return res.results ?? [];
  } catch (e) {
    console.warn("get products error", e);
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
    await IAP.purchaseItemAsync(sku);
    return { ok: true }; // listener confirms completion
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "purchase failed" };
  }
}

/** Restore previous purchases (Play handles this automatically for subs). */
export async function restorePurchases(): Promise<boolean> {
  try {
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

/** Wire the global purchase listener once at app boot. */
export function setupPurchaseListener() {
  if (listenerWired) return;
  listenerWired = true;
  IAP.setPurchaseListener(({ responseCode, results, errorCode }) => {
    if (responseCode === IAP.IAPResponseCode.OK && results?.length) {
      results.forEach((p) => {
        IAP.finishTransactionAsync(p, false).catch(() => {});
      });
      useSubscriptionStore.getState().markPremium();
    } else if (responseCode === IAP.IAPResponseCode.ERROR && errorCode) {
      console.warn("purchase listener error", errorCode);
    }
  });
}
