/**
 * Soul Journal design tokens — LIGHT MINT/EMERALD (matches the web's emerald theme
 * as shown in Amer's screenshot: hsl(140 20% 95%) → hsl(145 18% 90%)).
 * Light/white only. NO dark navy / purple.
 */
export const colors = {
  // Primary — ocean blue (web --primary: hsl(211 85% 52%), shown in screenshot)
  primary: "#1d81ed",
  primarySoft: "#3db8f5",
  primaryLight: "#e0f2fe",
  // Background gradient — web emerald theme (screenshot: #F0F5F1 → #FCFEFB)
  bgTop: "#f0f5f1",
  bgMid: "#e8f0ea",
  bgBottom: "#fcfefb",
  // Cards — frosted white glass (web .glass-premium)
  card: "#ffffff",
  cardGlass: "rgba(255,255,255,0.68)",
  cardGlassStrong: "rgba(255,255,255,0.8)",
  // Text
  text: "#192434", // web --foreground hsl(215 35% 15%)
  textMuted: "#52637a", // web --muted-foreground hsl(215 20% 40%)
  textFaint: "#8ba0b8",
  // Borders / hairline — tinted sky (web --border hsl(205 40% 85%), glass border hsl(215 40% 78% / 0.5))
  border: "#c9dbe8",
  glassBorder: "rgba(173,196,220,0.55)",
  // Accents
  accent: "#3db8f5",
  amber: "#fabd2e",
  amberLight: "#fef3c7",
  danger: "#ef4444",
  white: "#ffffff",
  // Mood colors (web sentiment tokens)
  mood: {
    happy: "#fabd2e", // hsl(42 95% 58%)
    good: "#fabd2e",
    fine: "#4296f0", // hsl(211 85% 60%)
    calm: "#5ebeed", // hsl(200 80% 65%)
    sad: "#db7082", // hsl(350 60% 65%)
    anxious: "#b48ae0",
    unhappy: "#db7082",
  },
};

export const fonts = {
  display: "PlayfairDisplay_600SemiBold",
  displayBold: "PlayfairDisplay_700Bold",
  displayCaveat: "Caveat_700Bold",
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemiBold: "Inter_600SemiBold",
  bodyBold: "Inter_700Bold",
};

/** Map a DisplayFont choice to the actual font family (used by useAppFonts). */
export const DISPLAY_FONT_FAMILY: Record<string, string> = {
  playfair: "PlayfairDisplay_600SemiBold",
  playfairBold: "PlayfairDisplay_700Bold",
  caveat: "Caveat_700Bold",
  caveatSemi: "Caveat_600SemiBold",
  inter: "Inter_700Bold",
};

export const radius = {
  card: 24, // web rounded-2xl / 1.5rem
  pill: 999,
  input: 14,
};

export const spacing = {
  page: 20,
  card: 16,
  gap: 12,
};

export const shadows = {
  // web .glass-premium shadow: 0 10px 30px -10px hsl(215 50% 25% / 0.25), inset highlight
  card: {
    shadowColor: "rgba(26,63,110,0.22)",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 6,
  },
  soft: {
    shadowColor: "rgba(26,63,110,0.12)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 3,
  },
};

/** Web .glass-premium card recipe — frosted white, tinted hairline, soft sky shadow. */
export const glassCard = {
  backgroundColor: colors.cardGlass,
  borderRadius: radius.card,
  borderWidth: 1,
  borderColor: colors.glassBorder,
  ...shadows.card,
} as const;
