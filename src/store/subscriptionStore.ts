import { create } from "zustand";
import { supabase } from "@/lib/supabase";

/** Owner email — the app owner always has premium access (same as web). */
export const OWNER_EMAIL = "amer.niyonzima@gmail.com";

export type PlanType = "monthly" | "yearly" | null;

interface SubscriptionState {
  isPremium: boolean;
  planType: PlanType;
  subscriptionEnd: string | null;
  /** Paid voice-replay add-ons (0,50 $ each / 10 for 4,99 $) granted by Stripe webhook. */
  voiceCredits: number;
  checked: boolean;
  checkSubscription: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Local unlock after a successful store purchase (backend reconcile later). */
  markPremium: (planType?: PlanType) => void;
}

/**
 * Premium check: owner email → always premium. Everyone else calls the
 * check-subscription edge fn (manual grant → Stripe sub → RevenueCat/store row).
 * Same contract as the web app's SubscriptionContext.
 */
export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  isPremium: false,
  planType: null,
  subscriptionEnd: null,
  voiceCredits: 0,
  checked: false,

  checkSubscription: async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) {
      set({ isPremium: false, planType: null, subscriptionEnd: null, voiceCredits: 0, checked: true });
      return;
    }

    // Owner always premium — no network call
    if (user.email?.toLowerCase() === OWNER_EMAIL.toLowerCase()) {
      set({ isPremium: true, planType: null, subscriptionEnd: null, voiceCredits: 0, checked: true });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) throw error;
      set({
        isPremium: !!data?.subscribed,
        planType: (data?.plan_type as PlanType) ?? (data?.tier as PlanType) ?? null,
        subscriptionEnd: data?.subscription_end ?? null,
        voiceCredits: data?.voice_credits ?? 0,
        checked: true,
      });
    } catch (e) {
      console.warn("check-subscription error", e);
      set({ isPremium: false, planType: null, subscriptionEnd: null, voiceCredits: 0, checked: true });
    }
  },

  refresh: async () => {
    await get().checkSubscription();
  },

  markPremium: (planType?: PlanType) => {
    set({ isPremium: true, planType: planType ?? null, checked: true });
  },
}));
