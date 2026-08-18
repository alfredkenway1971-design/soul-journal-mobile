import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";

/**
 * All 16 fonts — same ids/behavior as the web's FontContext.
 * inter/system keep Playfair headings; cursive fonts flag for Title Case.
 */
export type FontId =
  | "inter" | "playfair" | "dancing" | "caveat" | "shadows" | "sacramento" | "kalam"
  | "alex-brush" | "euphoria" | "great-vibes" | "tangerine" | "patrick" | "petit-formal"
  | "satisfy" | "arizonia" | "system";

export const FONT_OPTIONS: {
  id: FontId;
  name: string;
  family: string;
  cursive?: boolean;
}[] = [
  { id: "inter", name: "Inter (Modern)", family: "Inter" },
  { id: "playfair", name: "Playfair (Classic)", family: "Playfair Display" },
  { id: "dancing", name: "Dancing Script", family: "Dancing Script", cursive: true },
  { id: "caveat", name: "Caveat (Phitradesign)", family: "Caveat", cursive: true },
  { id: "shadows", name: "Shadows Into Light", family: "Shadows Into Light", cursive: true },
  { id: "sacramento", name: "Sacramento (Agata)", family: "Sacramento", cursive: true },
  { id: "kalam", name: "Kalam (Alanis)", family: "Kalam", cursive: true },
  { id: "alex-brush", name: "Alex Brush (Honey Script)", family: "Alex Brush", cursive: true },
  { id: "euphoria", name: "Euphoria Script", family: "Euphoria Script", cursive: true },
  { id: "great-vibes", name: "Great Vibes (Scriptina)", family: "Great Vibes", cursive: true },
  { id: "tangerine", name: "Tangerine (Anke)", family: "Tangerine", cursive: true },
  { id: "patrick", name: "Patrick Hand (Gravity)", family: "Patrick Hand", cursive: true },
  { id: "petit-formal", name: "Petit Formal (Quilline)", family: "Petit Formal Script", cursive: true },
  { id: "satisfy", name: "Satisfy (Farewell)", family: "Satisfy", cursive: true },
  { id: "arizonia", name: "Arizonia", family: "Arizonia", cursive: true },
  { id: "system", name: "System Default", family: "System" },
];

const DEFAULT_FONT: FontId = "inter";
const DEFAULT_SIZE = 16;
const KEY = "sj-font";

interface FontState {
  font: FontId;
  fontSize: number;
  isCursive: boolean;
  setFont: (f: FontId) => Promise<void>;
  setFontSize: (n: number) => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useFontStore = create<FontState>((set, get) => ({
  font: DEFAULT_FONT,
  fontSize: DEFAULT_SIZE,
  isCursive: false,

  setFont: async (font) => {
    const cursive = !!FONT_OPTIONS.find((o) => o.id === font)?.cursive;
    set({ font, isCursive: cursive });
    try { await AsyncStorage.setItem(KEY, JSON.stringify({ font, fontSize: get().fontSize })); } catch {}
    // Persist to the profile (same columns as web) for cross-device sync
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        await supabase.from("profiles").update({ app_font: font } as any).eq("id", data.session.user.id);
      }
    } catch {}
  },

  setFontSize: async (fontSize) => {
    set({ fontSize });
    try { await AsyncStorage.setItem(KEY, JSON.stringify({ font: get().font, fontSize })); } catch {}
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        await supabase.from("profiles").update({ app_font_size: fontSize } as any).eq("id", data.session.user.id);
      }
    } catch {}
  },

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p?.font) {
          const cursive = !!FONT_OPTIONS.find((o) => o.id === p.font)?.cursive;
          set({ font: p.font, isCursive: cursive, fontSize: p.fontSize || DEFAULT_SIZE });
          return;
        }
      }
    } catch {}
    // Fallback: read the DB choice (web parity — device choice wins, DB as fallback)
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("app_font, app_font_size")
          .eq("id", data.session.user.id)
          .maybeSingle();
        const dbFont = (prof as any)?.app_font as string | null;
        if (dbFont && FONT_OPTIONS.some((o) => o.id === dbFont)) {
          const cursive = !!FONT_OPTIONS.find((o) => o.id === dbFont)?.cursive;
          set({ font: dbFont as FontId, isCursive: cursive });
        }
      }
    } catch {}
  },
}));

/** Body + display family map for the active font (web parity: inter/system -> Playfair headings). */
export function fontFamilies(font: FontId) {
  const cursive = !!FONT_OPTIONS.find((o) => o.id === font)?.cursive;
  switch (font) {
    case "inter":
      return {
        body: "Inter_400Regular",
        bodyMedium: "Inter_500Medium",
        bodySemiBold: "Inter_600SemiBold",
        bodyBold: "Inter_700Bold",
        display: "PlayfairDisplay_600SemiBold",
        displayBold: "PlayfairDisplay_700Bold",
        cursive,
      };
    case "system":
      return {
        body: undefined,
        bodyMedium: undefined,
        bodySemiBold: undefined,
        bodyBold: undefined,
        display: "PlayfairDisplay_600SemiBold",
        displayBold: "PlayfairDisplay_700Bold",
        cursive,
      };
    case "playfair":
      return {
        body: "Inter_400Regular",
        bodyMedium: "Inter_500Medium",
        bodySemiBold: "Inter_600SemiBold",
        bodyBold: "Inter_700Bold",
        display: "PlayfairDisplay_600SemiBold",
        displayBold: "PlayfairDisplay_700Bold",
        cursive,
      };
    case "dancing":
      return {
        body: "DancingScript_400Regular",
        bodyMedium: "DancingScript_500Medium",
        bodySemiBold: "DancingScript_600SemiBold",
        bodyBold: "DancingScript_700Bold",
        display: "DancingScript_700Bold",
        displayBold: "DancingScript_700Bold",
        cursive,
      };
    case "caveat":
      return {
        body: "Caveat_600SemiBold",
        bodyMedium: "Caveat_600SemiBold",
        bodySemiBold: "Caveat_600SemiBold",
        bodyBold: "Caveat_700Bold",
        display: "Caveat_700Bold",
        displayBold: "Caveat_700Bold",
        cursive,
      };
    case "shadows":
      return { body: "ShadowsIntoLight_400Regular", bodyMedium: "ShadowsIntoLight_400Regular", bodySemiBold: "ShadowsIntoLight_400Regular", bodyBold: "ShadowsIntoLight_400Regular", display: "ShadowsIntoLight_400Regular", displayBold: "ShadowsIntoLight_400Regular", cursive };
    case "sacramento":
      return { body: "Sacramento_400Regular", bodyMedium: "Sacramento_400Regular", bodySemiBold: "Sacramento_400Regular", bodyBold: "Sacramento_400Regular", display: "Sacramento_400Regular", displayBold: "Sacramento_400Regular", cursive };
    case "kalam":
      return { body: "Kalam_400Regular", bodyMedium: "Kalam_400Regular", bodySemiBold: "Kalam_400Regular", bodyBold: "Kalam_700Bold", display: "Kalam_700Bold", displayBold: "Kalam_700Bold", cursive };
    case "alex-brush":
      return { body: "AlexBrush_400Regular", bodyMedium: "AlexBrush_400Regular", bodySemiBold: "AlexBrush_400Regular", bodyBold: "AlexBrush_400Regular", display: "AlexBrush_400Regular", displayBold: "AlexBrush_400Regular", cursive };
    case "euphoria":
      return { body: "EuphoriaScript_400Regular", bodyMedium: "EuphoriaScript_400Regular", bodySemiBold: "EuphoriaScript_400Regular", bodyBold: "EuphoriaScript_400Regular", display: "EuphoriaScript_400Regular", displayBold: "EuphoriaScript_400Regular", cursive };
    case "great-vibes":
      return { body: "GreatVibes_400Regular", bodyMedium: "GreatVibes_400Regular", bodySemiBold: "GreatVibes_400Regular", bodyBold: "GreatVibes_400Regular", display: "GreatVibes_400Regular", displayBold: "GreatVibes_400Regular", cursive };
    case "tangerine":
      return { body: "Tangerine_400Regular", bodyMedium: "Tangerine_400Regular", bodySemiBold: "Tangerine_400Regular", bodyBold: "Tangerine_700Bold", display: "Tangerine_700Bold", displayBold: "Tangerine_700Bold", cursive };
    case "patrick":
      return { body: "PatrickHand_400Regular", bodyMedium: "PatrickHand_400Regular", bodySemiBold: "PatrickHand_400Regular", bodyBold: "PatrickHand_400Regular", display: "PatrickHand_400Regular", displayBold: "PatrickHand_400Regular", cursive };
    case "petit-formal":
      return { body: "PetitFormalScript_400Regular", bodyMedium: "PetitFormalScript_400Regular", bodySemiBold: "PetitFormalScript_400Regular", bodyBold: "PetitFormalScript_400Regular", display: "PetitFormalScript_400Regular", displayBold: "PetitFormalScript_400Regular", cursive };
    case "satisfy":
      return { body: "Satisfy_400Regular", bodyMedium: "Satisfy_400Regular", bodySemiBold: "Satisfy_400Regular", bodyBold: "Satisfy_400Regular", display: "Satisfy_400Regular", displayBold: "Satisfy_400Regular", cursive };
    case "arizonia":
      return { body: "Arizonia_400Regular", bodyMedium: "Arizonia_400Regular", bodySemiBold: "Arizonia_400Regular", bodyBold: "Arizonia_400Regular", display: "Arizonia_400Regular", displayBold: "Arizonia_400Regular", cursive };
    default:
      return {
        body: "Inter_400Regular", bodyMedium: "Inter_500Medium", bodySemiBold: "Inter_600SemiBold", bodyBold: "Inter_700Bold",
        display: "PlayfairDisplay_600SemiBold", displayBold: "PlayfairDisplay_700Bold", cursive: false,
      };
  }
}
