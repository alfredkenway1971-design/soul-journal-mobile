import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme";
import { useAuthStore } from "@/store/authStore";
import AuthScreen from "@/screens/AuthScreen";
import HomeScreen from "@/screens/HomeScreen";
import RecordScreen from "@/screens/RecordScreen";
import LibraryScreen from "@/screens/LibraryScreen";
import ProfileScreen from "@/screens/ProfileScreen";

const Tab = createBottomTabNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.bgTop,
    card: colors.card,
    text: colors.text,
    border: colors.border,
  },
};

const TABS = [
  { name: "Home", component: HomeScreen, icon: "home" as const, iconActive: "home" as const, label: "Accueil" },
  { name: "Record", component: RecordScreen, icon: "mic-outline" as const, iconActive: "mic" as const, label: "Écrire" },
  { name: "Library", component: LibraryScreen, icon: "library-outline" as const, iconActive: "library" as const, label: "Bibliothèque" },
  { name: "Profile", component: ProfileScreen, icon: "person-outline" as const, iconActive: "person" as const, label: "Profil" },
];

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
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

  if (loading) {
    return null; // splash shows while session restores
  }

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style="dark" />
      {user ? <MainTabs /> : <AuthScreen />}
    </NavigationContainer>
  );
}
