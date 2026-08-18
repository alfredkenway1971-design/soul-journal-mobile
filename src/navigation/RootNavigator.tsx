import { useEffect, useState } from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "@/theme";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { useT } from "@/store/settingsStore";
import { useSubscriptionStore } from "@/store/subscriptionStore";
import AuthScreen from "@/screens/AuthScreen";
import HomeScreen from "@/screens/HomeScreen";
import RecordScreen from "@/screens/RecordScreen";
import LibraryScreen from "@/screens/LibraryScreen";
import ProfileScreen from "@/screens/ProfileScreen";
import EntryDetailScreen from "@/screens/EntryDetailScreen";
import VoiceScreen from "@/screens/VoiceScreen";
import GoalsScreen from "@/screens/GoalsScreen";
import SoulMirrorScreen from "@/screens/SoulMirrorScreen";
import PrivacyScreen from "@/screens/PrivacyScreen";
import PricingScreen from "@/screens/PricingScreen";
import RemindersScreen from "@/screens/RemindersScreen";
import ExportScreen from "@/screens/ExportScreen";
import AdminScreen from "@/screens/AdminScreen";
import OnboardingScreen from "@/screens/OnboardingScreen";
import CalendarScreen from "@/screens/CalendarScreen";
import InsightsScreen from "@/screens/InsightsScreen";
import CoachingScreen from "@/screens/CoachingScreen";
import FontsScreen from "@/screens/FontsScreen";
import ThemesScreen from "@/screens/ThemesScreen";
import PinSettingsScreen from "@/screens/PinSettingsScreen";
import GratitudeScreen from "@/screens/GratitudeScreen";
import RelationsScreen from "@/screens/RelationsScreen";

export type RootStackParamList = {
  Main: undefined;
  EntryDetail: { id: string };
  Voice: undefined;
  Goals: undefined;
  SoulMirror: undefined;
  Privacy: undefined;
  Pricing: undefined;
  Reminders: undefined;
  Export: undefined;
  Admin: undefined;
  Onboarding: undefined;
  Calendar: undefined;
  Insights: undefined;
  Coaching: undefined;
  Fonts: undefined;
  Themes: undefined;
  PinSettings: undefined;
  Gratitude: undefined;
  Relations: undefined;
};

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.bgTop,
    card: colors.cardGlassStrong,
    text: colors.text,
    border: colors.glassBorder,
  },
};

function MainTabs() {
  const t = useT();
  const TABS = [
    { name: "Home", component: HomeScreen, icon: "home-outline" as const, iconActive: "home" as const, label: t("nav.home") },
    { name: "Record", component: RecordScreen, icon: "mic-outline" as const, iconActive: "mic" as const, label: t("nav.record") },
    { name: "Library", component: LibraryScreen, icon: "library-outline" as const, iconActive: "library" as const, label: t("nav.library") },
    { name: "Profile", component: ProfileScreen, icon: "person-outline" as const, iconActive: "person" as const, label: t("nav.profile") },
  ];

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: {
          backgroundColor: colors.cardGlassStrong,
          borderTopColor: colors.glassBorder,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
          position: "absolute",
          left: 12,
          right: 12,
          bottom: 10,
          borderRadius: 24,
          shadowColor: "rgba(26,63,110,0.25)",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 1,
          shadowRadius: 20,
          elevation: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600", fontFamily: fonts.bodySemiBold },
      }}
    >
      {TABS.map((tab) => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.component}
          options={{
            tabBarLabel: tab.label,
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons name={focused ? tab.iconActive : tab.icon} size={size} color={color} />
            ),
          }}
        />
      ))}
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const [onboarded, setOnboarded] = useState(true);
  const checkSubscription = useSubscriptionStore((s) => s.checkSubscription);

  // Re-check premium status + onboarding state whenever the user changes
  useEffect(() => {
    if (user) {
      checkSubscription();
      supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          setOnboarded(data?.onboarding_completed !== false);
        });
    } else {
      setOnboarded(true);
    }
  }, [user, checkSubscription]);

  if (loading) {
    return null; // splash shows while session restores
  }

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style="dark" />
      {user ? (
        !onboarded ? (
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          </Stack.Navigator>
        ) : (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="EntryDetail" component={EntryDetailScreen} />
          <Stack.Screen name="Voice" component={VoiceScreen} />
          <Stack.Screen name="Goals" component={GoalsScreen} />
          <Stack.Screen name="SoulMirror" component={SoulMirrorScreen} />
          <Stack.Screen name="Privacy" component={PrivacyScreen} />
          <Stack.Screen name="Pricing" component={PricingScreen} />
          <Stack.Screen name="Reminders" component={RemindersScreen} />
          <Stack.Screen name="Export" component={ExportScreen} />
          <Stack.Screen name="Admin" component={AdminScreen} />
          <Stack.Screen name="Calendar" component={CalendarScreen} />
          <Stack.Screen name="Insights" component={InsightsScreen} />
          <Stack.Screen name="Coaching" component={CoachingScreen} />
          <Stack.Screen name="Fonts" component={FontsScreen} />
          <Stack.Screen name="Themes" component={ThemesScreen} />
          <Stack.Screen name="PinSettings" component={PinSettingsScreen} />
          <Stack.Screen name="Gratitude" component={GratitudeScreen} />
          <Stack.Screen name="Relations" component={RelationsScreen} />
        </Stack.Navigator>
        )
      ) : (
        <AuthScreen />
      )}
    </NavigationContainer>
  );
}
