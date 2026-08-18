import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { colors, radius, fonts, glassCard, shadows } from "@/theme";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { useT } from "@/store/settingsStore";

const MOOD_EMOJI: Record<string, string> = {
  happy: "😊", good: "😇", fine: "😌", sad: "😔", unhappy: "😢",
};
const MOOD_COLOR: Record<string, string> = {
  happy: "#fabd2e", good: "#fabd2e", fine: "#4296f0", calm: "#5ebeed", sad: "#db7082", unhappy: "#db7082",
};

interface DayEntry {
  id: string;
  title: string | null;
  mood: string | null;
  created_at: string;
}

const WEEKDAYS = ["D", "L", "M", "M", "J", "V", "S"];

export default function CalendarScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const user = useAuthStore((s) => s.user);
  const t = useT();
  const [month, setMonth] = useState(() => new Date());
  const [entries, setEntries] = useState<DayEntry[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;

  const load = useCallback(async () => {
    if (!user) return;
    const start = `${monthKey}-01T00:00:00`;
    const end = `${monthKey}-31T23:59:59`;
    const { data } = await supabase
      .from("journal_entries")
      .select("id, title, mood, created_at")
      .eq("user_id", user.id)
      .gte("created_at", start)
      .lte("created_at", end)
      .order("created_at", { ascending: true });
    setEntries((data ?? []) as DayEntry[]);
  }, [user, monthKey]);

  useEffect(() => {
    load();
  }, [load]);

  const dayMap = useMemo(() => {
    const map: Record<string, DayEntry[]> = {};
    for (const e of entries) {
      const key = e.created_at.slice(0, 10);
      (map[key] ||= []).push(e);
    }
    return map;
  }, [entries]);

  const days = useMemo(() => {
    const y = month.getFullYear();
    const m = month.getMonth();
    const first = new Date(y, m, 1);
    const count = new Date(y, m + 1, 0).getDate();
    const leading = first.getDay(); // 0=Sun
    const out: (number | null)[] = Array(leading).fill(null);
    for (let d = 1; d <= count; d++) out.push(d);
    return out;
  }, [month]);

  const selectedEntries = selectedKey ? dayMap[selectedKey] ?? [] : [];

  const shiftMonth = (delta: number) => {
    setSelectedKey(null);
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  };

  return (
    <LinearGradient colors={[colors.bgTop, colors.bgMid, colors.bgBottom]} style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.iconBtnText}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>📅 Calendrier</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Month navigation */}
        <View style={[styles.monthBar, shadows.soft]}>
          <Pressable onPress={() => shiftMonth(-1)} hitSlop={10}>
            <Text style={styles.monthArrow}>‹</Text>
          </Pressable>
          <Text style={styles.monthLabel}>
            {month.toLocaleDateString("fr-CA", { month: "long", year: "numeric" })}
          </Text>
          <Pressable onPress={() => shiftMonth(1)} hitSlop={10}>
            <Text style={styles.monthArrow}>›</Text>
          </Pressable>
        </View>

        {/* Calendar grid */}
        <View style={[styles.calendarCard, shadows.card]}>
          <View style={styles.weekRow}>
            {WEEKDAYS.map((d, i) => (
              <Text key={i} style={styles.weekDay}>{d}</Text>
            ))}
          </View>
          <View style={styles.grid}>
            {days.map((d, i) => {
              if (d == null) return <View key={`e${i}`} style={styles.cell} />;
              const key = `${monthKey}-${String(d).padStart(2, "0")}`;
              const dayEntries = dayMap[key];
              const mood = dayEntries?.[dayEntries.length - 1]?.mood;
              const isSelected = selectedKey === key;
              const isToday = new Date().toISOString().slice(0, 10) === key;
              return (
                <Pressable
                  key={key}
                  style={[styles.cell, isSelected && styles.cellSelected]}
                  onPress={() => setSelectedKey(isSelected ? null : key)}
                >
                  <Text style={[styles.dayNum, isToday && { color: colors.primary, fontWeight: "800" }]}>{d}</Text>
                  {mood && <Text style={styles.dayMood}>{MOOD_EMOJI[mood]}</Text>}
                  {!mood && isToday && <View style={styles.todayDot} />}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Selected day entries */}
        <Text style={styles.sectionLabel}>
          {selectedKey ? new Date(selectedKey + "T12:00:00").toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" }) : "Touchez un jour"}
        </Text>
        {selectedEntries.length === 0 ? (
          <Text style={styles.empty}>Aucune entrée ce jour.</Text>
        ) : (
          selectedEntries.map((e) => (
            <Pressable
              key={e.id}
              style={[styles.entryCard, shadows.soft]}
              onPress={() => navigation.navigate("EntryDetail", { id: e.id })}
            >
              <Text style={styles.entryMood}>{MOOD_EMOJI[e.mood ?? ""] ?? "📝"}</Text>
              <Text style={styles.entryTitle} numberOfLines={1}>{e.title || "Sans titre"}</Text>
              <Text style={styles.entryArrow}>→</Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 999,
    backgroundColor: colors.cardGlassStrong, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.glassBorder,
  },
  iconBtnText: { fontSize: 20, color: colors.primary, fontFamily: fonts.bodyBold },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 18, color: colors.text, fontFamily: fonts.displayBold },
  monthBar: {
    ...glassCard,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginBottom: 14,
  },
  monthArrow: { fontSize: 28, color: colors.primary, fontFamily: fonts.bodyBold, paddingHorizontal: 8 },
  monthLabel: { fontSize: 15, color: colors.text, fontFamily: fonts.displayBold },
  calendarCard: {
    ...glassCard,
    padding: 12,
    marginBottom: 16,
  },
  weekRow: { flexDirection: "row", marginBottom: 6 },
  weekDay: { flex: 1, textAlign: "center", fontSize: 11, color: colors.textFaint, fontFamily: fonts.bodySemiBold },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: {
    width: "14.28%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  cellSelected: { backgroundColor: colors.primaryLight },
  dayNum: { fontSize: 13, color: colors.text, fontFamily: fonts.bodyMedium },
  dayMood: { fontSize: 13, marginTop: 1 },
  todayDot: { width: 5, height: 5, borderRadius: 999, backgroundColor: colors.primary, marginTop: 2 },
  sectionLabel: { fontSize: 14, color: colors.text, fontFamily: fonts.bodySemiBold, marginBottom: 10 },
  empty: { color: colors.textMuted, fontSize: 13, textAlign: "center", paddingVertical: 12, fontFamily: fonts.body },
  entryCard: {
    ...glassCard,
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    marginBottom: 8,
  },
  entryMood: { fontSize: 20, marginRight: 12 },
  entryTitle: { flex: 1, fontSize: 14, color: colors.text, fontFamily: fonts.bodySemiBold },
  entryArrow: { fontSize: 16, color: colors.textFaint },
});
