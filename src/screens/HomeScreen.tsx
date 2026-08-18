import { useCallback, useEffect, useState, useMemo } from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { colors, radius, fonts, glassCard, shadows } from "@/theme";
import { useAppFonts, type AppFonts } from "@/hooks/useAppFonts";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { useT } from "@/store/settingsStore";
import EntryCard from "@/components/EntryCard";

interface Entry {
  id: string;
  title: string | null;
  mood: string | null;
  created_at: string;
}

const fmtRelative = (iso: string) => {
  try {
    const d = new Date(iso);
    const now = new Date();
    const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
    if (diffDays <= 0) return "home.today";
    if (diffDays === 1) return "home.yesterday";
    return d.toLocaleDateString("fr-CA", { day: "numeric", month: "long" });
  } catch {
    return iso;
  }
};

const computeStreak = (dates: string[]): number => {
  if (!dates.length) return 0;
  const days = new Set(
    dates.map((iso) => {
      const d = new Date(iso);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    })
  );
  let streak = 0;
  const cursor = new Date();
  // If today has no entry yet, allow streak to start from yesterday.
  const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  if (!days.has(key(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(key(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
};

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const appFonts = useAppFonts();
  const styles = useMemo(() => makeStyles(appFonts), [appFonts]);
  const t = useT();
  const navigation = useNavigation<any>();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [insight, setInsight] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: profile }, { data: rows }, { count }, { data: latestInsight }] = await Promise.all([
      supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
      supabase
        .from("journal_entries")
        .select("id, title, mood, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("journal_entries")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("coaching_insights")
        .select("content")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (profile?.display_name) setDisplayName(profile.display_name);
    if (rows) setEntries(rows);
    if (count != null) setTotalCount(count);
    if (latestInsight?.content) setInsight(latestInsight.content);
    // streak needs all dates — lightweight select
    const { data: allDates } = await supabase
      .from("journal_entries")
      .select("created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(500);
    if (allDates) setStreak(computeStreak(allDates.map((e) => e.created_at)));
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const firstName = displayName?.split(" ")[0] || user?.email?.split("@")[0] || "";
  const initials = (displayName || user?.email || "SJ")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const lastEntryRaw = entries[0] ? fmtRelative(entries[0].created_at) : "—";
  const lastEntry = lastEntryRaw.startsWith("home.") ? t(lastEntryRaw) : lastEntryRaw;

  return (
    <LinearGradient colors={[colors.bgTop, colors.bgMid, colors.bgBottom]} style={styles.root}>
      <FlatList
        data={entries}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <View>
            {/* Header */}
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.hello}>{t("home.greeting")} {firstName} ✨</Text>
                <Text style={styles.subtitle}>{t("record.subtitle")}</Text>
              </View>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            </View>

            {/* Journey Recap (web .glass-premium stats card) */}
            <View style={[styles.recapCard, shadows.card]}>
              <View style={styles.recapHeader}>
                <Text style={styles.recapTitle}>{t("home.journey")}</Text>
              </View>
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>🔥 {streak}</Text>
                  <Text style={styles.statLabel}>{t("home.dayStreak")}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statValue}>📖 {totalCount}</Text>
                  <Text style={styles.statLabel}>{t("home.totalEntries")}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statValue}>🕐 {lastEntry}</Text>
                  <Text style={styles.statLabel}>{t("home.lastEntry")}</Text>
                </View>
              </View>
            </View>

            {/* AI Insight (web home card — always visible with fallback like the web) */}
            <View style={[styles.insightCard, shadows.card]}>
              <View style={styles.insightHeader}>
                <Text style={styles.insightBadge}>✨ {t("home.aiInsight")}</Text>
              </View>
              <Text style={styles.insightText}>
                {insight || t("home.aiInsightEmpty")}
              </Text>
            </View>

            {/* Soul Mirror home card (web has this above Quick Capture) */}
            <Pressable style={[styles.soulMirrorCard, shadows.card]} onPress={() => navigation.navigate("SoulMirror")}>
              <View style={styles.soulMirrorRow}>
                <View style={styles.soulMirrorIcon}>
                  <Text style={styles.soulMirrorEmoji}>🪞</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.soulMirrorTitle}>Soul Mirror</Text>
                  <Text style={styles.soulMirrorDesc}>Votre portrait mensuel — laissez l'IA vous éclairer.</Text>
                </View>
                <Text style={styles.soulMirrorArrow}>→</Text>
              </View>
            </Pressable>

            {/* Quick capture */}
            <Pressable style={[styles.quickCard, shadows.soft]} onPress={() => navigation.navigate("Record")}>
              <View style={styles.quickIconWrap}>
                <Text style={styles.quickEmoji}>🎙️</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.quickTitle}>{t("home.quickTitle")}</Text>
                <Text style={styles.quickDesc}>{t("home.quickDesc")}</Text>
              </View>
              <Text style={styles.quickArrow}>→</Text>
            </Pressable>

            <Text style={styles.sectionTitle}>{t("home.recentEntries")}</Text>
          </View>
        }
        renderItem={({ item }) => <EntryCard entry={item} />}
        ListEmptyComponent={
          <Text style={styles.empty}>{t("home.empty")}</Text>
        }
      />
    </LinearGradient>
  );
}

const makeStyles = (appFonts: AppFonts) => StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, paddingBottom: 110 },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  hello: {
    fontSize: 30,
    color: colors.text,
    fontFamily: appFonts.displayBold,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
    fontFamily: appFonts.body,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.7)",
  },
  avatarText: { color: colors.white, fontSize: 16, fontWeight: "700", fontFamily: appFonts.bodyBold },
  recapCard: {
    ...glassCard,
    padding: 18,
    marginBottom: 16,
  },
  recapHeader: { marginBottom: 12 },
  recapTitle: {
    fontSize: 16,
    color: colors.text,
    fontFamily: appFonts.display,
  },
  statsRow: { flexDirection: "row", alignItems: "center" },
  stat: { flex: 1, alignItems: "center" },
  statDivider: { width: 1, height: 34, backgroundColor: colors.glassBorder },
  statValue: {
    fontSize: 17,
    color: colors.text,
    fontFamily: appFonts.bodyBold,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: "center",
    fontFamily: appFonts.body,
  },
  insightCard: {
    ...glassCard,
    padding: 18,
    marginBottom: 16,
    backgroundColor: "rgba(255,255,255,0.75)",
  },
  insightHeader: { marginBottom: 8 },
  insightBadge: {
    fontSize: 13,
    color: colors.primary,
    fontFamily: appFonts.bodyBold,
  },
  insightText: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.text,
    fontFamily: appFonts.body,
  },
  soulMirrorCard: {
    ...glassCard,
    padding: 16,
    marginBottom: 16,
    backgroundColor: "rgba(255,255,255,0.75)",
  },
  soulMirrorRow: { flexDirection: "row", alignItems: "center" },
  soulMirrorIcon: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  soulMirrorEmoji: { fontSize: 22 },
  soulMirrorTitle: { fontSize: 15, color: colors.text, fontFamily: appFonts.bodySemiBold },
  soulMirrorDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2, fontFamily: appFonts.body },
  soulMirrorArrow: { fontSize: 18, color: colors.primary, fontWeight: "700" },
  quickCard: {
    flexDirection: "row",
    alignItems: "center",
    ...glassCard,
    padding: 16,
    marginBottom: 24,
  },
  quickIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  quickEmoji: { fontSize: 22 },
  quickTitle: {
    fontSize: 15,
    color: colors.text,
    fontFamily: appFonts.bodySemiBold,
  },
  quickDesc: { fontSize: 13, color: colors.textMuted, marginTop: 2, fontFamily: appFonts.body },
  quickArrow: { fontSize: 18, color: colors.primary, fontWeight: "700" },
  sectionTitle: {
    fontSize: 17,
    color: colors.text,
    fontFamily: appFonts.display,
    marginBottom: 12,
  },
  empty: { color: colors.textMuted, fontSize: 14, textAlign: "center", marginTop: 24, fontFamily: appFonts.body },
});
