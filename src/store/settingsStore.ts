import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type AppLanguage = "en" | "fr" | "es" | "ar" | "zh" | "ja" | "sw" | "de";

const KEY = "sj-settings";

interface SettingsState {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  language: "fr", // app defaults to French (Quebec)

  setLanguage: async (language) => {
    set({ language });
    try {
      await AsyncStorage.setItem(KEY, JSON.stringify({ language }));
    } catch {}
  },

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.language) set({ language: parsed.language });
      }
    } catch {}
  },
}));

/** Simple dictionary — full i18n (8 languages) mirrors the web app; Phase 2. */
const dict: Record<string, Record<string, Record<string, string>>> = {
  home: {
    fr: { greeting: "Bonjour", entries: "Entrées", streak: "Série" },
    en: { greeting: "Hello", entries: "Entries", streak: "Streak" },
  },
};

export const t = (key: string, lang: AppLanguage = "fr"): string => {
  const [section, k] = key.split(".");
  return dict[section]?.[lang]?.[k] ?? dict[section]?.en?.[k] ?? key;
};
