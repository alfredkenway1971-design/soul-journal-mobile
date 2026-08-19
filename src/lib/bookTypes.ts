/**
 * Soul Book Builder — shared types & configs (web parity: /root/soul-journal
 * BookBuilderPage + book-builder components + generateBookPDF.ts).
 * Ported 2026-08-19 for the mobile app.
 */

export type CoverTemplate = "nebula" | "minimalist" | "botanical" | "midnight" | "sunrise";

export type BookFont =
  | "modern"
  | "classic"
  | "handwritten"
  | "phitradesign"
  | "shadows-into-light"
  | "agata"
  | "alanis"
  | "honey-script"
  | "euphoria-script"
  | "scriptina"
  | "anke-calligraphic"
  | "gravity"
  | "quilline-script"
  | "farewell"
  | "arizonia";

export type PageBackground = "blank" | "lined" | "dotted";
export type EntryLayout = "one-per-page" | "continuous" | "magazine" | "photo-forward";
export type PhotoSize = "small" | "medium" | "large";
export type FontSize = "small" | "medium" | "large";

export interface BookConfig {
  cover: CoverTemplate;
  font: BookFont;
  background: PageBackground;
  layout: EntryLayout;
  watermark: boolean;
  userName: string;
  yearRange: string;
  avatarUrl: string | null;
  showAvatar: boolean;
  photoSize?: PhotoSize;
  fontSize?: FontSize;
}

export interface JournalEntry {
  id: string;
  title: string | null;
  enhanced_text: string | null;
  original_transcription: string | null;
  mood: string | null;
  created_at: string;
  photoUrls?: string[];
  soul_reflection?: string | null;
}

/* ── Fonts (web FontSelector config) ── */

export interface BookFontConfig {
  id: BookFont;
  name: string;
  category: "modern" | "classic" | "handwritten";
  preview: string;
  importUrl: string;
  css: string;
  /** In-app expo-font family name (all loaded at App root) for live previews. */
  appFamily: string;
}

export const BOOK_FONTS: BookFontConfig[] = [
  { id: "modern", name: "Modern", category: "modern", preview: "Clean & tech-forward", importUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Quicksand:wght@400;500;600&display=swap", css: "'Inter', 'Quicksand', sans-serif", appFamily: "Inter_400Regular" },
  { id: "classic", name: "Classic", category: "classic", preview: "Timeless & reflective", importUrl: "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap", css: "'Playfair Display', 'EB Garamond', Georgia, serif", appFamily: "PlayfairDisplay_600SemiBold" },
  { id: "handwritten", name: "Dancing Script", category: "handwritten", preview: "Intimate & personal", importUrl: "https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;500;600;700&display=swap", css: "'Dancing Script', cursive", appFamily: "DancingScript_500Medium" },
  { id: "phitradesign", name: "Phitradesign", category: "handwritten", preview: "Hand-drawn & playful", importUrl: "https://fonts.googleapis.com/css2?family=Caveat:wght@400;500;600;700&display=swap", css: "'Caveat', cursive", appFamily: "Caveat_600SemiBold" },
  { id: "shadows-into-light", name: "Shadows Into Light", category: "handwritten", preview: "Casual & sketchy", importUrl: "https://fonts.googleapis.com/css2?family=Shadows+Into+Light&display=swap", css: "'Shadows Into Light', cursive", appFamily: "ShadowsIntoLight_400Regular" },
  { id: "agata", name: "Agata", category: "handwritten", preview: "Flowing calligraphic", importUrl: "https://fonts.googleapis.com/css2?family=Sacramento&display=swap", css: "'Sacramento', cursive", appFamily: "Sacramento_400Regular" },
  { id: "alanis", name: "Alanis", category: "handwritten", preview: "Natural handwriting", importUrl: "https://fonts.googleapis.com/css2?family=Kalam:wght@300;400;700&display=swap", css: "'Kalam', cursive", appFamily: "Kalam_400Regular" },
  { id: "honey-script", name: "Honey Script Light", category: "handwritten", preview: "Elegant & delicate", importUrl: "https://fonts.googleapis.com/css2?family=Alex+Brush&display=swap", css: "'Alex Brush', cursive", appFamily: "AlexBrush_400Regular" },
  { id: "euphoria-script", name: "Euphoria Script", category: "handwritten", preview: "Joyful & expressive", importUrl: "https://fonts.googleapis.com/css2?family=Euphoria+Script&display=swap", css: "'Euphoria Script', cursive", appFamily: "EuphoriaScript_400Regular" },
  { id: "scriptina", name: "Scriptina", category: "handwritten", preview: "Formal calligraphy", importUrl: "https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap", css: "'Great Vibes', cursive", appFamily: "GreatVibes_400Regular" },
  { id: "anke-calligraphic", name: "Anke Calligraphic", category: "handwritten", preview: "Classic calligraphic", importUrl: "https://fonts.googleapis.com/css2?family=Tangerine:wght@400;700&display=swap", css: "'Tangerine', cursive", appFamily: "Tangerine_400Regular" },
  { id: "gravity", name: "Gravity", category: "handwritten", preview: "Casual & friendly", importUrl: "https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap", css: "'Patrick Hand', cursive", appFamily: "PatrickHand_400Regular" },
  { id: "quilline-script", name: "Quilline Script Thin", category: "handwritten", preview: "Thin & refined", importUrl: "https://fonts.googleapis.com/css2?family=Petit+Formal+Script&display=swap", css: "'Petit Formal Script', cursive", appFamily: "PetitFormalScript_400Regular" },
  { id: "farewell", name: "Farewell", category: "handwritten", preview: "Flowing & graceful", importUrl: "https://fonts.googleapis.com/css2?family=Satisfy&display=swap", css: "'Satisfy', cursive", appFamily: "Satisfy_400Regular" },
  { id: "arizonia", name: "Arizonia", category: "handwritten", preview: "Sweeping & bold", importUrl: "https://fonts.googleapis.com/css2?family=Arizonia&display=swap", css: "'Arizonia', cursive", appFamily: "Arizonia_400Regular" },
];

export const getBookFontConfig = (font: BookFont): BookFontConfig =>
  BOOK_FONTS.find((f) => f.id === font)!;

/* ── Covers (web CoverTemplates) ── */

export const COVER_TEMPLATES: { id: CoverTemplate; nameKey: string; descKey: string }[] = [
  { id: "nebula", nameKey: "cover.nebula", descKey: "cover.nebulaDesc" },
  { id: "minimalist", nameKey: "cover.minimalist", descKey: "cover.minimalistDesc" },
  { id: "botanical", nameKey: "cover.botanical", descKey: "cover.botanicalDesc" },
  { id: "midnight", nameKey: "cover.midnight", descKey: "cover.midnightDesc" },
  { id: "sunrise", nameKey: "cover.sunrise", descKey: "cover.sunriseDesc" },
];

export const COVER_GRADIENTS: Record<CoverTemplate, string> = {
  nebula: "linear-gradient(135deg, #7c3aed 0%, #db2777 50%, #6366f1 100%)",
  minimalist: "linear-gradient(180deg, #fafaf9 0%, #f5f5f4 100%)",
  botanical: "linear-gradient(135deg, #ecfccb 0%, #d9f99d 30%, #fce7f3 100%)",
  midnight: "linear-gradient(180deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)",
  sunrise: "linear-gradient(135deg, #fbbf24 0%, #f97316 50%, #ef4444 100%)",
};

/** expo-linear-gradient color arrays — same palettes as COVER_GRADIENTS. */
export const COVER_GRADIENT_COLORS: Record<CoverTemplate, readonly [string, string, ...string[]]> = {
  nebula: ["#7c3aed", "#db2777", "#6366f1"],
  minimalist: ["#fafaf9", "#f5f5f4"],
  botanical: ["#ecfccb", "#d9f99d", "#fce7f3"],
  midnight: ["#0f172a", "#1e1b4b", "#312e81"],
  sunrise: ["#fbbf24", "#f97316", "#ef4444"],
};

export const COVER_TEXT_COLORS: Record<CoverTemplate, string> = {
  nebula: "#ffffff",
  minimalist: "#292524",
  botanical: "#44403c",
  midnight: "#ffffff",
  sunrise: "#ffffff",
};

export const isLightCover = (c: CoverTemplate) => c === "minimalist" || c === "botanical";

/** Deterministic star positions for the midnight cover (web uses Math.random per render — we freeze it). */
export const MIDNIGHT_STARS: { top: `${number}%`; left: `${number}%`; size: number }[] = [
  { top: "12%", left: "8%", size: 1.5 }, { top: "20%", left: "72%", size: 1 }, { top: "9%", left: "45%", size: 2 },
  { top: "26%", left: "22%", size: 1 }, { top: "33%", left: "88%", size: 1.5 }, { top: "18%", left: "92%", size: 1 },
  { top: "42%", left: "12%", size: 2 }, { top: "50%", left: "58%", size: 1 }, { top: "38%", left: "34%", size: 1.5 },
  { top: "58%", left: "18%", size: 1 }, { top: "65%", left: "82%", size: 2 }, { top: "72%", left: "38%", size: 1 },
  { top: "80%", left: "64%", size: 1.5 }, { top: "88%", left: "15%", size: 1 }, { top: "84%", left: "90%", size: 2 },
  { top: "48%", left: "78%", size: 1.5 }, { top: "30%", left: "55%", size: 1 }, { top: "68%", left: "52%", size: 1 },
];

/* ── Size maps (web generateBookPDF) ── */

export const getFontSizePx = (size: FontSize): { body: number; title: number; meta: number } => {
  switch (size) {
    case "small": return { body: 16, title: 22, meta: 13 };
    case "large": return { body: 32, title: 46, meta: 22 };
    case "medium":
    default: return { body: 22, title: 32, meta: 16 };
  }
};

export const getCoverFontSizes = (size: FontSize): { subtitle: number; title: number; year: number; avatar: number } => {
  switch (size) {
    case "small": return { subtitle: 28, title: 80, year: 24, avatar: 200 };
    case "large": return { subtitle: 44, title: 128, year: 38, avatar: 280 };
    case "medium":
    default: return { subtitle: 36, title: 100, year: 30, avatar: 240 };
  }
};

export const getPhotoDimensions = (size: PhotoSize): { w: number; h: number } => {
  switch (size) {
    case "small": return { w: 100, h: 75 };
    case "large": return { w: 240, h: 180 };
    case "medium":
    default: return { w: 160, h: 120 };
  }
};

export const FONT_SIZE_ORDER: FontSize[] = ["small", "medium", "large"];
export const PHOTO_SIZE_ORDER: PhotoSize[] = ["small", "medium", "large"];
export const LAYOUT_ORDER: EntryLayout[] = ["one-per-page", "continuous", "magazine", "photo-forward"];
export const BACKGROUND_ORDER: PageBackground[] = ["blank", "lined", "dotted"];

/** Escape user text then convert newlines to <br> (escape FIRST — same order as web). */
export const escMultiline = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");

/** Smart title case — mirror the web's smartTitleCase (keeps short words lowercase). */
const LOWER_WORDS = new Set(["a", "an", "the", "and", "but", "or", "for", "nor", "on", "at", "to", "from", "by", "of", "in", "with"]);
export const smartTitleCase = (s: string): string => {
  if (!s) return s;
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => {
      if (i > 0 && LOWER_WORDS.has(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
};

/** Detect RTL text (Arabic, Hebrew…) — same regex as web. */
export const isRTLText = (text: string): boolean =>
  /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/.test(text);
