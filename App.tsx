import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts, PlayfairDisplay_600SemiBold, PlayfairDisplay_700Bold } from "@expo-google-fonts/playfair-display";
import { Caveat_600SemiBold, Caveat_700Bold } from "@expo-google-fonts/caveat";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { useAuthStore } from "@/store/authStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useFontStore } from "@/store/fontStore";
import { useThemeStore } from "@/store/themeStore";
import { usePinStore } from "@/store/pinStore";
import { setupPurchaseListener } from "@/lib/billing";
import PinLockScreen from "@/screens/PinLockScreen";
import RootNavigator from "@/navigation/RootNavigator";

// Global Play Billing purchase listener — must be set before any purchase
setupPurchaseListener();

export default function App() {
  const initialize = useAuthStore((s) => s.initialize);
  const hydrate = useSettingsStore((s) => s.hydrate);
  const hydrateFont = useFontStore((s) => s.hydrate);
  const hydrateTheme = useThemeStore((s) => s.hydrate);
  const hydratePin = usePinStore((s) => s.hydrate);
  const pinLocked = usePinStore((s) => s.locked);
  const hasPin = usePinStore((s) => s.hasPin);

  const [fontsLoaded] = useFonts({
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
    Caveat_600SemiBold,
    Caveat_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    initialize();
    hydrate();
    hydrateFont();
    hydrateTheme();
    hydratePin();
  }, [initialize, hydrate, hydrateFont, hydrateTheme, hydratePin]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      {hasPin && pinLocked ? <PinLockScreen /> : <RootNavigator />}
    </SafeAreaProvider>
  );
}
