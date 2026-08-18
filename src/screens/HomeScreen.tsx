import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, shadows } from "@/theme";
import { useAppFonts, type AppFonts } from "@/hooks/useAppFonts";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { useSettingsStore, useT } from "@/store/settingsStore";
import { useSubscriptionStore } from "@/store/subscriptionStore";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import WeatherBadge from "@/components/WeatherBadge";
import { LANGUAGES } from "@/i18n/translations";

const MOOD_EMOJI: Record<string, string> = {
  happy: "😄", good: "😊", excited: "🤩", fine: "🙂", calm: "😌",
  sad: "😔", anxious: "😰", angry: "😠", unhappy: "😢",
};

// Same filter set as the web MoodFilterBar
const MOOD_FILTERS = [
  { value: "all", label: "All", emoji: "✨" },
  { value: "good", label: "Grateful", emoji: "😇" },
  { value: "happy", label: "Happy", emoji: "😊" },
  { value: "fine", label: "Peaceful", emoji: "😌" },
  { value: "sad", label: "Sad", emoji: "😔" },
  { value: "unhappy", label: "Anxious", emoji: "😢" },
] as const;

interface Entry {
  id: string;
  title: string | null;
  mood: string | null;
  created_at: string;
  preview?: string;
  duration?: string;
}

// Same streak logic as the web HomePage (toDateString, timezone-safe)
const computeStreak = (dates: string[]): number => {
  if (!dates.length) return 0;
  const unique = [...new Set(dates.map((iso) => new Date(iso).toDateString()))]
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  if (unique.length === 0) return 0;
  let streak = 0;
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  let cursor = unique[0] === today || unique[0] === yesterday ? unique[0] : null;
  if (!cursor) return 0;
  const index = unique.indexOf(cursor);
  for (let i = index; i < unique.length; i++) {
    const expected = new Date(new Date(cursor).getTime() - (i - index) * 86400000).toDateString();
    if (unique[i] !== expected) break;
    streak += 1;
  }
  return streak;
};

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const appFonts = useAppFonts();
  const styles = useMemo(() => makeStyles(appFonts), [appFonts]);
  const t = useT();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const isPremium = useSubscriptionStore((s) => s.isPremium);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [insight, setInsight] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [moodFilter, setMoodFilter] = useState<string>("all");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: profile }, { data: rows }, { count }, { data: latestInsight }] = await Promise.all([
      supabase.from("profiles").select("display_name, avatar_url").eq("id", user.id).maybeSingle(),
      supabase
        .from("journal_entries")
        .select("id, title, mood, created_at, enhanced_text, original_transcription, duration_seconds")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
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
    if (profile?.avatar_url) setAvatarUrl(profile.avatar_url);
    if (rows) {
      setEntries(
        (rows as any[]).map((e) => {
          const dur = (e as any).duration_seconds;
          const duration = dur && dur > 0
            ? `${Math.floor(dur / 60)}:${String(Math.round(dur % 60)).padStart(2, "0")}`
            : undefined;
          return {
            id: e.id,
            title: e.title,
            mood: e.mood,
            created_at: e.created_at,
            preview: (e.enhanced_text || e.original_transcription || "").substring(0, 80),
            duration,
          };
        })
      );
    }
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

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? t("home.morning") : currentHour < 17 ? t("home.afternoon") : t("home.evening");
  const activeLang = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0];

  // Milestone emoji + label (web parity)
  const milestoneEmoji = totalCount >= 10 ? "📖" : totalCount >= 5 ? "🎯" : totalCount >= 3 ? "✨" : "🌱";
  const milestoneLabel =
    totalCount >= 10 ? t("home.bookBuilder") :
    totalCount >= 5 ? t("home.coaching") :
    totalCount >= 3 ? t("home.aiInsights") : t("home.gettingStarted");

  // Progressive unlock hint (web parity)
  const unlockHint =
    totalCount < 3 ? `✨ ${3 - totalCount} ${t("home.unlockAIInsights")}` :
    totalCount < 5 ? `✨ ${5 - totalCount} ${t("home.unlockCoaching")}` :
    totalCount < 10 ? `✨ ${10 - totalCount} ${t("home.unlockBookBuilder")}` :
    `🎉 ${t("home.allUnlocked")}`;

  const filtered = moodFilter === "all" ? entries : entries.filter((e) => e.mood === moodFilter);

  return (
    <LinearGradient colors={[colors.bgTop, colors.bgMid, colors.bgBottom]} style={styles.root}>
      <FlatList
        data={filtered.slice(0, 5)}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <View>
            {/* ── Header: greeting + weather + flag + avatar ── */}
            <View style={styles.headerRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.greeting, appFonts.cursive && { textTransform: "capitalize" }]}>
                  {greeting}, {firstName}
                </Text>
                <WeatherBadge />
              </View>
              <View style={styles.headerRight}>
                <Pressable style={styles.flagBtn} onPress={() => navigation.navigate("Profile" as any)}>
                  <Text style={styles.flagText}>{activeLang.flag}</Text>
                </Pressable>
                <Pressable onPress={() => navigation.navigate("ProfileSettings" as any)}>
                  {avatarUrl ? (
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{initials}</Text>
                    </View>
                  ) : (
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{initials}</Text>
                    </View>
                  )}
                </Pressable>
              </View>
            </View>

            {/* ── Journey Recap ── */}
            <View style={[styles.journeyCard, shadows.card]}>
              <View style={styles.journeyHeader}>
                <Ionicons name="flame" size={20} color="#f97316" />
                <Text style={styles.journeyTitle}>{t("home.journey")}</Text>
              </View>
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <View style={styles.statIconRow}>
                    <Ionicons name="flame-outline" size={16} color={streak > 0 ? "#f97316" : "#94a3b8"} />
                    <Text style={styles.statValue}>{streak}</Text>
                  </View>
                  <Text style={styles.statLabel}>{t("home.dayStreak")}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <View style={styles.statIconRow}>
                    <Ionicons name="trending-up" size={16} color="#10b981" />
                    <Text style={styles.statValue}>{totalCount}</Text>
                  </View>
                  <Text style={styles.statLabel}>{t("home.totalEntries")}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <View style={styles.statIconRow}>
                    <Ionicons name="time-outline" size={16} color="#3b82f6" />
                    <Text style={styles.statValueEmoji}>{milestoneEmoji}</Text>
                  </View>
                  <Text style={styles.statLabel}>{milestoneLabel}</Text>
                </View>
              </View>
              <View style={styles.hintDivider} />
              <Text style={styles.hintText}>{unlockHint}</Text>
            </View>

            {/* ── AI Insight ── */}
            <Pressable style={[styles.insightCard, shadows.card]} onPress={() => navigation.navigate("Record" as any)}>
              <View style={styles.insightBadge}>
                <Ionicons name="sparkles" size={14} color={colors.primary} />
                <Text style={styles.insightBadgeText}>{t("insight.badge")}</Text>
              </View>
              <Text style={[styles.insightText, appFonts.cursive && { fontStyle: "italic" }]}>
                "{insight || t("home.aiInsightEmpty")}"
              </Text>
              <View style={styles.insightCta}>
                <Text style={styles.insightCtaText}>{t("insight.tapToJournal")}</Text>
                <Ionicons name="arrow-forward" size={16} color={colors.textMuted} />
              </View>
            </Pressable>

            {/* ── Soul Mirror ── */}
            <Pressable style={[styles.soulMirrorCard, shadows.card]} onPress={() => navigation.navigate("SoulMirror")}>
              <View style={styles.soulMirrorIcon}>
                <Text style={styles.soulMirrorEmoji}>✨</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.soulMirrorTitle}>
                  {t("soulMirror.title")} {isPremium && <Text style={{ color: "#f59e0b" }}>👑</Text>}
                </Text>
                <Text style={styles.soulMirrorTagline} numberOfLines={1}>{t("soulMirror.homeTagline")}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.primary} />
            </Pressable>

            {/* ── Quick Capture ── */}
            <Pressable style={[styles.quickCard, shadows.card]} onPress={() => navigation.navigate("Record" as any)}>
              <View style={styles.micCircle}>
                <Ionicons name="mic" size={34} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.quickTitle}>{t("quickCapture.title")}</Text>
                <Text style={styles.quickVoice}>{t("quickCapture.voiceNote")}</Text>
                <Text style={styles.quickDesc}>{t("quickCapture.tapToRecord")}</Text>
              </View>
            </Pressable>

            {/* ── Mood Filter ── */}
            <Text style={styles.sectionTitle}>{t("home.moodFilter")}</Text>
            <View style={styles.moodRow}>
              {MOOD_FILTERS.map((m) => {
                const active = moodFilter === m.value;
                return (
                  <Pressable
                    key={m.value}
                    style={[styles.moodPill, active && styles.moodPillActive]}
                    onPress={() => setMoodFilter(m.value)}
                  >
                    <Text style={styles.moodEmoji}>{m.emoji}</Text>
                    <Text style={[styles.moodLabel, active && { color: "#ffffff" }]}>{m.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* ── Recent Entries ── */}
            <View style={styles.recentHeader}>
              <Text style={styles.sectionTitle}>{t("home.recentEntries")}</Text>
              <Pressable onPress={() => navigation.navigate("Calendar")}>
                <Text style={styles.viewAll}>{t("home.viewAll")}</Text>
              </Pressable>
            </View>
            {entries.length === 0 && (
              <View style={[styles.emptyCard, shadows.soft]}>
                <Text style={styles.emptyEmoji}>📝</Text>
                <Text style={styles.emptyText}>{t("home.noEntries")}</Text>
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.entryCard, shadows.soft, pressed && { opacity: 0.85 }]}
            onPress={() => navigation.navigate("EntryDetail", { id: item.id })}
          >
            <View style={styles.entryTop}>
              <Text style={styles.entryDate}>
                {new Date(item.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })},{" "}
                {new Date(item.created_at).toLocaleDateString("en-US", { weekday: "long" })}
              </Text>
              {item.duration && (
                <View style={styles.audioRow}>
                  <Ionicons name="analytics" size={16} color={colors.textMuted} />
                  <Text style={styles.entryDuration}>{item.duration}</Text>
                </View>
              )}
            </View>
            <Text style={styles.entryTitle}>
              {item.title || t("entry.untitled")} <Text style={styles.entryMood}>{MOOD_EMOJI[item.mood ?? ""] ?? "🙂"}</Text>
            </Text>
            {item.preview ? (
              <Text style={styles.entryPreview} numberOfLines={2}>{item.preview}...</Text>
            ) : (
              <View style={styles.previewPlaceholder} />
            )}
          </Pressable>
        )}
        ListEmptyComponent={
          entries.length === 0 ? null : (
            <View style={[styles.emptyCard, shadows.soft]}>
              <Text style={styles.emptyEmoji}>🌱</Text>
              <Text style={styles.emptyText}>{t("home.noMoodMemories")}</Text>
            </View>
          )
        }
      />
    </LinearGradient>
  );
}

const makeStyles = (appFonts: AppFonts) => StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, paddingBottom: 110 },
  // Header
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 },
  greeting: {
    fontSize: 30,
    lineHeight: 36,
    color: "#1e3a5f",
    fontFamily: appFonts.displayBold,
    letterSpacing: -0.5,
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 2 },
  flagBtn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.75)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
  },
  flagText: { fontSize: 16 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 999,
    backgroundColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.7)",
    shadowColor: "rgba(26,63,110,0.2)",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarText: { color: "#ffffff", fontSize: 18, fontWeight: "700", fontFamily: appFonts.bodyBold },
  // Journey Recap
  journeyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  journeyHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  journeyTitle: { fontSize: 17, color: "#1e293b", fontFamily: appFonts.bodyBold },
  statsRow: { flexDirection: "row", alignItems: "center" },
  stat: { flex: 1, alignItems: "center" },
  statIconRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 },
  statValue: { fontSize: 22, color: "#1e293b", fontFamily: appFonts.bodyBold },
  statValueEmoji: { fontSize: 20 },
  statLabel: { fontSize: 11, color: "#64748b", textAlign: "center", fontFamily: appFonts.body },
  statDivider: { width: 1, height: 32, backgroundColor: "#eef2f6" },
  hintDivider: { borderTopWidth: 1, borderTopColor: "#eef2f6", marginTop: 12, paddingTop: 10 },
  hintText: { fontSize: 12, color: "#64748b", textAlign: "center", fontFamily: appFonts.body },
  // AI Insight (light blue gradient like web --gradient-insight)
  insightCard: {
    backgroundColor: "#e3eef9",
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
  },
  insightBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.65)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: "flex-start",
    marginBottom: 12,
  },
  insightBadgeText: { fontSize: 12, color: colors.primary, fontWeight: "700", fontFamily: appFonts.bodyBold },
  insightText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#1e293b",
    fontFamily: appFonts.body,
    marginBottom: 14,
  },
  insightCta: { flexDirection: "row", alignItems: "center", gap: 6 },
  insightCtaText: { fontSize: 13, color: "#64748b", fontFamily: appFonts.bodyMedium },
  // Soul Mirror (emerald tint like web from-emerald-50 to-teal-50)
  soulMirrorCard: {
    backgroundColor: "#e0f2e9",
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.25)",
  },
  soulMirrorIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.85)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.2)",
  },
  soulMirrorEmoji: { fontSize: 20 },
  soulMirrorTitle: { fontSize: 15, color: "#1e293b", fontFamily: appFonts.bodySemiBold },
  soulMirrorTagline: { fontSize: 12, color: "#64748b", marginTop: 2, fontFamily: appFonts.body },
  // Quick Capture
  quickCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  micCircle: {
    width: 76,
    height: 76,
    borderRadius: 999,
    backgroundColor: "#eaf3fd",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
  },
  quickTitle: { fontSize: 12, color: "#64748b", fontFamily: appFonts.body },
  quickVoice: { fontSize: 20, color: "#1e293b", fontFamily: appFonts.bodyBold, marginVertical: 2 },
  quickDesc: { fontSize: 13, color: "#64748b", fontFamily: appFonts.body },
  // Mood filter
  sectionTitle: { fontSize: 19, color: "#1e293b", fontFamily: appFonts.bodyBold, marginBottom: 10 },
  moodRow: { flexDirection: "row", gap: 10, marginBottom: 22, flexWrap: "wrap" },
  moodPill: {
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
  moodPillActive: {
    backgroundColor: colors.primary,
    borderColor: "rgba(255,255,255,0.35)",
    shadowColor: "rgba(29,129,237,0.4)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
  },
  moodEmoji: { fontSize: 15 },
  moodLabel: { fontSize: 13, color: "#1e293b", fontFamily: appFonts.bodyMedium },
  // Recent entries
  recentHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  viewAll: { fontSize: 13, color: colors.primary, fontFamily: appFonts.bodySemiBold },
  entryCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  entryTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  entryDate: { fontSize: 11, color: "#64748b", fontWeight: "600", letterSpacing: 0.4, fontFamily: appFonts.bodyMedium },
  audioRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  entryDuration: { fontSize: 12, color: "#64748b", fontFamily: appFonts.bodyMedium },
  entryTitle: { fontSize: 15, color: "#1e293b", fontFamily: appFonts.bodySemiBold, marginBottom: 4 },
  entryMood: { fontSize: 14 },
  entryPreview: { fontSize: 13, color: "#64748b", lineHeight: 18, fontFamily: appFonts.body },
  previewPlaceholder: { height: 36 },
  emptyCard: {
    backgroundColor: "rgba(255,255,255,0.7)",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  emptyEmoji: { fontSize: 32, marginBottom: 10 },
  emptyText: { fontSize: 14, color: "#64748b", textAlign: "center", fontFamily: appFonts.body },
});
