import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts, PlayfairDisplay_600SemiBold, PlayfairDisplay_700Bold } from "@expo-google-fonts/playfair-display";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { useAuthStore } from "@/store/authStore";
import { useSettingsStore } from "@/store/settingsStore";
import RootNavigator from "@/navigation/RootNavigator";

export default function App() {
  const initialize = useAuthStore((s) => s.initialize);
  const hydrate = useSettingsStore((s) => s.hydrate);

  const [fontsLoaded] = useFonts({
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    initialize();
    hydrate();
  }, [initialize, hydrate]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <RootNavigator />
    </SafeAreaProvider>
  );
}
