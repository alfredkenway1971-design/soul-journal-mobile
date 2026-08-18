import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { colors, radius, fonts, glassCard, shadows } from "@/theme";
import { useAppFonts, type AppFonts } from "@/hooks/useAppFonts";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { useT } from "@/store/settingsStore";

const MOOD_SCORE: Record<string, number> = { happy: 5, good: 4, fine: 3, calm: 3, sad: 2, unhappy: 1, anxious: 2 };
const MOOD_EMOJI: Record<string, string> = { happy: "😊", good: "😇", fine: "😌", calm: "😌", sad: "😔", unhappy: "😢", anxious: "😟" };
const MOOD_COLOR: Record<string, string> = {
  happy: "#fabd2e", good: "#fabd2e", fine: "#4296f0", calm: "#5ebeed", sad: "#db7082", unhappy: "#db7082", anxious: "#b48ae0",
};

const WEEKDAY_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

export default function InsightsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const appFonts = useAppFonts();
  const styles = useMemo(() => makeStyles(appFonts), [appFonts]);
  const user = useAuthStore((s) => s.user);
  const t = useT();
  const [weekly, setWeekly] = useState<{ day: string; avg: number; mood: string | null }[]>([]);
  const [distribution, setDistribution] = useState<{ mood: string; count: number }[]>([]);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    if (!user) return;
    // Last 7 days
    const since = new Date();
    since.setDate(since.getDate() - 6);
    since.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from("journal_entries")
      .select("mood, mood_score, created_at")
      .eq("user_id", user.id)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: true });

    const rows = (data ?? []) as { mood: string; mood_score: number | null; created_at: string }[];
    setTotal(rows.length);

    // Per weekday averages (last 7 days)
    const byDay: Record<number, { sum: number; n: number }> = {};
    for (const r of rows) {
      const d = new Date(r.created_at);
      const dow = d.getDay();
      const score = r.mood_score ?? MOOD_SCORE[r.mood] ?? 3;
      byDay[dow] ||= { sum: 0, n: 0 };
      byDay[dow].sum += score;
      byDay[dow].n += 1;
    }
    const week: { day: string; avg: number; mood: string | null }[] = [];
    for (let i = 0; i < 7; i++) {
      const b = byDay[i];
      week.push({ day: WEEKDAY_LABELS[i], avg: b ? b.sum / b.n : 0, mood: null });
    }
    setWeekly(week);

    // Mood distribution
    const dist: Record<string, number> = {};
    for (const r of rows) dist[r.mood] = (dist[r.mood] ?? 0) + 1;
    setDistribution(Object.entries(dist).map(([mood, count]) => ({ mood, count })).sort((a, b) => b.count - a.count));
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const maxCount = useMemo(() => Math.max(1, ...distribution.map((d) => d.count)), [distribution]);

  return (
    <LinearGradient colors={[colors.bgTop, colors.bgMid, colors.bgBottom]} style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.iconBtnText}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{t("insights.title")}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Weekly mood chart */}
        <View style={[styles.card, shadows.card]}>
          <Text style={styles.cardTitle}>{t("insights.thisWeek")}</Text>
          <Text style={styles.cardSub}>{total} {total > 1 ? t("insights.entries7").replace("{count}", String(total)) : t("insights.entry7").replace("{count}", String(total))}</Text>
          <View style={styles.chart}>
            {weekly.map((w, i) => (
              <View key={i} style={styles.chartCol}>
                <View style={styles.chartBarWrap}>
                  {w.avg > 0 && (
                    <View style={[styles.chartBar, { height: Math.max(8, w.avg * 16) }]} />
                  )}
                </View>
                <Text style={styles.chartLabel}>{w.day}</Text>
                {w.avg > 0 && <Text style={styles.chartVal}>{w.avg.toFixed(1)}</Text>}
              </View>
            ))}
          </View>
        </View>

        {/* Mood distribution */}
        <View style={[styles.card, shadows.card]}>
          <Text style={styles.cardTitle}>{t("insights.moodDist")}</Text>
          {distribution.length === 0 ? (
            <Text style={styles.empty}>{t("insights.noData")}</Text>
          ) : (
            distribution.map((d, i) => (
              <View key={i} style={styles.distRow}>
                <Text style={styles.distEmoji}>{MOOD_EMOJI[d.mood] ?? "📝"}</Text>
                <Text style={styles.distLabel}>{d.mood}</Text>
                <View style={styles.distBarWrap}>
                  <View style={[styles.distBar, { width: `${(d.count / maxCount) * 100}%`, backgroundColor: MOOD_COLOR[d.mood] ?? colors.primary }]} />
                </View>
                <Text style={styles.distCount}>{d.count}</Text>
              </View>
            ))
          )}
        </View>

        {/* AI insight teaser */}
        <View style={[styles.card, shadows.card]}>
          <Text style={styles.cardTitle}>{t("insights.ai")}</Text>
          <Text style={styles.cardBody}>
            {t("insights.writeFirst")}
          </Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const makeStyles = (appFonts: AppFonts) => StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 999,
    backgroundColor: colors.cardGlassStrong, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.glassBorder,
  },
  iconBtnText: { fontSize: 20, color: colors.primary, fontFamily: appFonts.bodyBold },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 18, color: colors.text, fontFamily: appFonts.displayBold },
  card: { ...glassCard, padding: 18, marginBottom: 14 },
  cardTitle: { fontSize: 15, color: colors.text, fontFamily: appFonts.displayBold },
  cardSub: { fontSize: 12, color: colors.textMuted, marginTop: 2, fontFamily: appFonts.body },
  cardBody: { fontSize: 13, color: colors.textMuted, marginTop: 8, lineHeight: 19, fontFamily: appFonts.body },
  chart: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 16, height: 130 },
  chartCol: { flex: 1, alignItems: "center" },
  chartBarWrap: { flex: 1, justifyContent: "flex-end", width: 22 },
  chartBar: { width: 22, borderRadius: 6, backgroundColor: colors.primary },
  chartLabel: { fontSize: 10, color: colors.textFaint, marginTop: 6, fontFamily: appFonts.bodyMedium },
  chartVal: { fontSize: 9, color: colors.textMuted, marginTop: 1, fontFamily: appFonts.body },
  empty: { color: colors.textMuted, fontSize: 13, marginTop: 10, fontFamily: appFonts.body },
  distRow: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  distEmoji: { fontSize: 18, marginRight: 8, width: 26 },
  distLabel: { fontSize: 13, color: colors.text, fontFamily: appFonts.bodyMedium, width: 80 },
  distBarWrap: { flex: 1, height: 12, backgroundColor: colors.primaryLight, borderRadius: 6, overflow: "hidden" },
  distBar: { height: 12, borderRadius: 6 },
  distCount: { fontSize: 13, color: colors.textMuted, fontFamily: appFonts.bodySemiBold, marginLeft: 8, width: 24, textAlign: "right" },
});
