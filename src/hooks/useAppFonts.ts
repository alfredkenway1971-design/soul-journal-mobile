import { useFontStore, fontFamilies } from "@/store/fontStore";

/** The full font family map consumed by makeStyles factories across the app. */
export interface AppFonts {
  body: string | undefined;
  bodyMedium: string | undefined;
  bodySemiBold: string | undefined;
  bodyBold: string | undefined;
  display: string | undefined;
  displayBold: string | undefined;
  cursive: boolean;
}

/**
 * Live-updating font families for the active font choice. Any component that
 * builds styles through a makeStyles(appFonts) factory re-renders when the
 * user changes the font, applying it across the whole app.
 */
export function useAppFonts(): AppFonts {
  const font = useFontStore((s) => s.font);
  return fontFamilies(font);
}
