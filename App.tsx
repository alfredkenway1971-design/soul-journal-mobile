import { useEffect } from "react";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useFonts, PlayfairDisplay_600SemiBold, PlayfairDisplay_700Bold } from "@expo-google-fonts/playfair-display";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { Caveat_600SemiBold, Caveat_700Bold } from "@expo-google-fonts/caveat";
import { DancingScript_400Regular, DancingScript_500Medium, DancingScript_600SemiBold, DancingScript_700Bold } from "@expo-google-fonts/dancing-script";
import { ShadowsIntoLight_400Regular } from "@expo-google-fonts/shadows-into-light";
import { Sacramento_400Regular } from "@expo-google-fonts/sacramento";
import { Kalam_400Regular, Kalam_700Bold } from "@expo-google-fonts/kalam";
import { AlexBrush_400Regular } from "@expo-google-fonts/alex-brush";
import { EuphoriaScript_400Regular } from "@expo-google-fonts/euphoria-script";
import { GreatVibes_400Regular } from "@expo-google-fonts/great-vibes";
import { Tangerine_400Regular, Tangerine_700Bold } from "@expo-google-fonts/tangerine";
import { PatrickHand_400Regular } from "@expo-google-fonts/patrick-hand";
import { PetitFormalScript_400Regular } from "@expo-google-fonts/petit-formal-script";
import { Satisfy_400Regular } from "@expo-google-fonts/satisfy";
import { Arizonia_400Regular } from "@expo-google-fonts/arizonia";
import { useAuthStore } from "@/store/authStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useFontStore } from "@/store/fontStore";
import { useThemeStore } from "@/store/themeStore";
import { usePinStore } from "@/store/pinStore";
import { setupPurchaseListener } from "@/lib/billing";
import PinLockScreen from "@/screens/PinLockScreen";
import RootNavigator from "@/navigation/RootNavigator";
import { colors } from "@/theme";

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
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Caveat_600SemiBold,
    Caveat_700Bold,
    DancingScript_400Regular,
    DancingScript_500Medium,
    DancingScript_600SemiBold,
    DancingScript_700Bold,
    ShadowsIntoLight_400Regular,
    Sacramento_400Regular,
    Kalam_400Regular,
    Kalam_700Bold,
    AlexBrush_400Regular,
    EuphoriaScript_400Regular,
    GreatVibes_400Regular,
    Tangerine_400Regular,
    Tangerine_700Bold,
    PatrickHand_400Regular,
    PetitFormalScript_400Regular,
    Satisfy_400Regular,
    Arizonia_400Regular,
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
      {/* Top safe-area so headers/back buttons never sit under the status bar / notch */}
      <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.bgTop }}>
        {hasPin && pinLocked ? <PinLockScreen /> : <RootNavigator />}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
