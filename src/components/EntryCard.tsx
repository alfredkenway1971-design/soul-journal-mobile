import { memo, useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { colors, shadows } from "@/theme";
import { useAppFonts, type AppFonts } from "@/hooks/useAppFonts";
import { useT } from "@/store/settingsStore";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

const MOOD_EMOJI: Record<string, string> = {
  happy: "😊",
  good: "😇",
  fine: "😌",
  sad: "😔",
  unhappy: "😢",
};

interface Props {
  entry: { id: string; title: string | null; mood: string | null; created_at: string };
}

// Screenshot format: small date top-left ("16 août"), bold title, mood emoji right of title
const fmtDate = (iso: string) => {
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString("fr-CA", { day: "numeric", month: "long" })} · ${d.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}`;
  } catch {
    return iso;
  }
};

export default memo(function EntryCard({ entry }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const t = useT();
  const appFonts = useAppFonts();
  const styles = useMemo(() => makeStyles(appFonts), [appFonts]);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, shadows.soft, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }]}
      onPress={() => navigation.navigate("EntryDetail", { id: entry.id })}
    >
      <Text style={styles.date}>{fmtDate(entry.created_at)}</Text>
      <View style={styles.row}>
        <Text style={styles.title} numberOfLines={2}>
          {entry.title || t("entry.untitled")}
        </Text>
        <Text style={styles.mood}>{MOOD_EMOJI[entry.mood ?? ""] ?? "📝"}</Text>
      </View>
    </Pressable>
  );
});

const makeStyles = (appFonts: AppFonts) => StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  date: {
    fontSize: 11,
    color: "#94a3b8",
    marginBottom: 6,
    fontFamily: appFonts.bodyMedium,
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1e293b",
    flex: 1,
    paddingRight: 8,
    fontFamily: appFonts.bodyBold,
  },
  mood: { fontSize: 20 },
});
