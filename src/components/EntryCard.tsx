import { memo, useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { colors, fonts, glassCard, shadows } from "@/theme";
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

const fmtDate = (iso: string) => {
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" })} · ${d.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}`;
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
    ...glassCard,
    padding: 16,
    marginBottom: 10,
  },
  date: {
    fontSize: 12,
    color: colors.textFaint,
    marginBottom: 6,
    fontFamily: appFonts.bodyMedium,
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
    flex: 1,
    paddingRight: 8,
    fontFamily: appFonts.bodySemiBold,
  },
  mood: { fontSize: 20 },
});
