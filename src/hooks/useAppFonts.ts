import { useFontStore } from "@/store/fontStore";
import { DISPLAY_FONT_FAMILY } from "@/theme";

/**
 * Returns the active display-font family for headings, live-updating when the
 * user changes it in Font settings. Body font stays Inter (like the web).
 */
export function useAppFonts() {
  const display = useFontStore((s) => s.display);
  return {
    display: DISPLAY_FONT_FAMILY[display === "caveat" ? "caveat" : display === "inter" ? "inter" : "playfair"],
    displayBold:
      display === "caveat"
        ? DISPLAY_FONT_FAMILY.caveat
        : display === "inter"
        ? DISPLAY_FONT_FAMILY.inter
        : DISPLAY_FONT_FAMILY.playfairBold,
    isCursive: display === "caveat",
  };
}
