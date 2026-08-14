import { memo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, radius } from "@/theme";

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
    return d.toLocaleDateString("fr-CA", { day: "numeric", month: "long" });
  } catch {
    return iso;
  }
};

export default memo(function EntryCard({ entry }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.date}>{fmtDate(entry.created_at)}</Text>
      <View style={styles.row}>
        <Text style={styles.title} numberOfLines={2}>
          {entry.title || "Sans titre"}
        </Text>
        <Text style={styles.mood}>{MOOD_EMOJI[entry.mood ?? ""] ?? "📝"}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  date: { fontSize: 12, color: colors.textFaint, marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 15, fontWeight: "600", color: colors.text, flex: 1, paddingRight: 8 },
  mood: { fontSize: 20 },
});
