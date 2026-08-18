import { memo, useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors, shadows } from "@/theme";
import { useAppFonts, type AppFonts } from "@/hooks/useAppFonts";
import { useT, useSettingsStore, localeFor } from "@/store/settingsStore";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

const MOOD_EMOJI: Record<string, string> = {
  happy: "😊",
  good: "😇",
  fine: "😌",
  sad: "😔",
  unhappy: "😢",
};

interface Entry {
  id: string;
  title: string | null;
  mood: string | null;
  created_at: string;
  enhanced_text?: string | null;
  original_transcription?: string | null;
  duration_seconds?: number | null;
}

interface Props {
  entry: Entry;
}

// Web RecentEntryCard format: "MMM d, EEEE" (e.g. "Aug 16, Sunday")
const fmtDate = (iso: string) => {
  try {
    const d = new Date(iso);
    const locale = localeFor(useSettingsStore.getState().language);
    const month = d.toLocaleDateString(locale, { month: "short" });
    const day = d.getDate();
    const weekday = d.toLocaleDateString(locale, { weekday: "long" });
    return `${month} ${day}, ${weekday}`;
  } catch {
    return iso;
  }
};

export default memo(function EntryCard({ entry }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const t = useT();
  const appFonts = useAppFonts();
  const styles = useMemo(() => makeStyles(appFonts), [appFonts]);

  const preview = entry.enhanced_text || entry.original_transcription || "";
  const dur = entry.duration_seconds;
  const duration = dur && dur > 0
    ? `${Math.floor(dur / 60)}:${String(Math.round(dur % 60)).padStart(2, "0")}`
    : undefined;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, shadows.soft, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }]}
      onPress={() => navigation.navigate("EntryDetail", { id: entry.id })}
    >
      <View style={styles.topRow}>
        <Text style={styles.date}>{fmtDate(entry.created_at)}</Text>
        {duration && (
          <View style={styles.audioRow}>
            <Ionicons name="analytics" size={14} color="#94a3b8" />
            <Text style={styles.duration}>{duration}</Text>
          </View>
        )}
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {entry.title || t("entry.untitled")} <Text style={styles.mood}>{MOOD_EMOJI[entry.mood ?? ""] ?? "🙂"}</Text>
      </Text>
      {preview ? (
        <Text style={styles.preview} numberOfLines={2}>{preview}</Text>
      ) : (
        <View style={styles.previewPlaceholder} />
      )}
    </Pressable>
  );
});

const makeStyles = (appFonts: AppFonts) =>
  StyleSheet.create({
    card: {
      backgroundColor: "#ffffff",
      borderRadius: 18,
      padding: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: "#e2e8f0",
    },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    date: {
      fontSize: 11,
      color: "#94a3b8",
      fontWeight: "600",
      letterSpacing: 0.3,
      fontFamily: appFonts.bodyMedium,
    },
    audioRow: { flexDirection: "row", alignItems: "center", gap: 5 },
    duration: { fontSize: 11, color: "#94a3b8", fontFamily: appFonts.bodyMedium },
    title: {
      fontSize: 16,
      fontWeight: "700",
      color: "#1e293b",
      fontFamily: appFonts.bodyBold,
      marginBottom: 4,
    },
    mood: { fontSize: 15 },
    preview: {
      fontSize: 13,
      color: "#64748b",
      lineHeight: 18,
      fontFamily: appFonts.body,
    },
    previewPlaceholder: { height: 36 },
  });
