import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useAuthStore } from "@/store/authStore";
import { useSettingsStore } from "@/store/settingsStore";
import RootNavigator from "@/navigation/RootNavigator";

export default function App() {
  const initialize = useAuthStore((s) => s.initialize);
  const hydrate = useSettingsStore((s) => s.hydrate);

  useEffect(() => {
    initialize();
    hydrate();
  }, [initialize, hydrate]);

  return (
    <SafeAreaProvider>
      <RootNavigator />
    </SafeAreaProvider>
  );
}
