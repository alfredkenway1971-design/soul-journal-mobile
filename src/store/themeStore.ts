import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

/** Light-only theme variants (Amer: no dark/black/blue-purple). */
export const THEME_OPTIONS = [
  {
    key: "sky",
    label: "Ciel",
    desc: "Bleu ciel doux (par défaut)",
    swatch: "#b1d1f1",
    gradient: ["#d2ecf9", "#b1d1f1", "#c4dff3"],
  },
  {
    key: "mint",
    label: "Menthe",
    desc: "Vert menthe léger",
    swatch: "#b8e6d0",
    gradient: ["#e0f2e9", "#c3e8d8", "#d8efe6"],
  },
  {
    key: "lilac",
    label: "Lilas",
    desc: "Lilas pastel clair",
    swatch: "#d8c9ef",
    gradient: ["#ede6f8", "#d9cdf0", "#e6dcf6"],
  },
  {
    key: "peach",
    label: "Pêche",
    desc: "Pêche douce et chaleureuse",
    swatch: "#f7d9c4",
    gradient: ["#fdeee4", "#f7dcc8", "#fbebdd"],
  },
] as const;

export type ThemeKey = (typeof THEME_OPTIONS)[number]["key"];

const KEY = "sj-theme";

interface ThemeState {
  theme: ThemeKey;
  setTheme: (t: ThemeKey) => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: "sky",
  setTheme: async (theme) => {
    set({ theme });
    try { await AsyncStorage.setItem(KEY, JSON.stringify({ theme })); } catch {}
  },
  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p?.theme) set({ theme: p.theme });
      }
    } catch {}
  },
}));

/** Active gradient for the current theme. */
export function useThemeGradient() {
  const theme = useThemeStore((s) => s.theme);
  return THEME_OPTIONS.find((o) => o.key === theme)?.gradient ?? ["#d2ecf9", "#b1d1f1", "#c4dff3"];
}
