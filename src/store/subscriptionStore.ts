import { create } from "zustand";
import { supabase } from "@/lib/supabase";

/** Owner email — the app owner always has premium access (same as web). */
export const OWNER_EMAIL = "amer.niyonzima@gmail.com";

interface SubscriptionState {
  isPremium: boolean;
  checked: boolean;
  checkSubscription: () => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Premium check: owner email → always premium. Everyone else calls the
 * check-subscription edge fn (manual grant → Stripe sub → admin role).
 * Same contract as the web app's SubscriptionContext.
 */
export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  isPremium: false,
  checked: false,

  checkSubscription: async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) {
      set({ isPremium: false, checked: true });
      return;
    }

    // Owner always premium — no network call
    if (user.email?.toLowerCase() === OWNER_EMAIL.toLowerCase()) {
      set({ isPremium: true, checked: true });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) throw error;
      set({ isPremium: !!data?.subscribed, checked: true });
    } catch (e) {
      console.warn("check-subscription error", e);
      set({ isPremium: false, checked: true });
    }
  },

  refresh: async () => {
    await get().checkSubscription();
  },
}));
