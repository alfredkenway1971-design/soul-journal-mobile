import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

/** Display font choices (body stays Inter — matches web FontContext behavior). */
export const FONT_OPTIONS = [
  { key: "playfair", label: "Playfair Display", native: "Classique" },
  { key: "caveat", label: "Caveat", native: "Écriture" },
  { key: "inter", label: "Inter", native: "Moderne" },
] as const;

export type DisplayFont = (typeof FONT_OPTIONS)[number]["key"];

const KEY = "sj-font";

interface FontState {
  display: DisplayFont;
  setDisplay: (f: DisplayFont) => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useFontStore = create<FontState>((set) => ({
  display: "playfair",
  setDisplay: async (display) => {
    set({ display });
    try { await AsyncStorage.setItem(KEY, JSON.stringify({ display })); } catch {}
  },
  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p?.display) set({ display: p.display });
      }
    } catch {}
  },
}));
