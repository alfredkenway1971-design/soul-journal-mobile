import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { translations } from "@/i18n/translations";

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

/**
 * Translate a dotted key ("home.recentEntries") in the active language.
 * Fallback chain: active lang -> English -> the raw key.
 */
export function useT() {
  const language = useSettingsStore((s) => s.language);
  return (key: string): string => translate(key, language);
}

export function translate(key: string, lang: AppLanguage = "fr"): string {
  const block = translations[lang] ?? translations.en;
  const val = block?.[key];
  if (val != null) return val;
  const enVal = translations.en?.[key];
  if (enVal != null) return enVal;
  return key;
}
