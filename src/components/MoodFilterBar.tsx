import { Pressable, Text, StyleSheet, View } from "react-native";
import { colors } from "@/theme";
import { useAppFonts, type AppFonts } from "@/hooks/useAppFonts";

export type MoodFilterValue = "all" | string;

// Same filter set as the web MoodFilterBar
export const MOOD_FILTERS: { value: MoodFilterValue; label: string; emoji: string }[] = [
  { value: "all", label: "All", emoji: "✨" },
  { value: "good", label: "Grateful", emoji: "😇" },
  { value: "happy", label: "Happy", emoji: "😊" },
  { value: "fine", label: "Peaceful", emoji: "😌" },
  { value: "sad", label: "Sad", emoji: "😔" },
  { value: "unhappy", label: "Anxious", emoji: "😢" },
];

interface Props {
  value: MoodFilterValue;
  onChange: (v: MoodFilterValue) => void;
}

/** Shared mood filter pill bar — identical to the web's MoodFilterBar. */
export default function MoodFilterBar({ value, onChange }: Props) {
  const appFonts = useAppFonts();
  const styles = makeStyles(appFonts);
  return (
    <View style={styles.row}>
      {MOOD_FILTERS.map((m) => {
        const active = m.value === value;
        return (
          <Pressable
            key={m.value}
            style={[styles.pill, active && styles.pillActive]}
            onPress={() => onChange(m.value)}
          >
            <Text style={styles.emoji}>{m.emoji}</Text>
            <Text style={[styles.label, active && { color: "#ffffff" }]}>{m.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (appFonts: AppFonts) =>
  StyleSheet.create({
    row: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: "rgba(255,255,255,0.7)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.7)",
    },
    pillActive: {
      backgroundColor: colors.primary,
      borderColor: "rgba(255,255,255,0.35)",
      shadowColor: "rgba(29,129,237,0.4)",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 10,
      elevation: 3,
    },
    emoji: { fontSize: 15 },
    label: { fontSize: 13, color: "#1e293b", fontFamily: appFonts.bodyMedium },
  });
