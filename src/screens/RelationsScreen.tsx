import { useCallback, useEffect, useState, useMemo } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { colors, radius, fonts, glassCard, shadows } from "@/theme";
import { useAppFonts, type AppFonts } from "@/hooks/useAppFonts";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { useT, useSettingsStore, localeFor } from "@/store/settingsStore";

const RELATIONS_URL = "https://soul-journal-seven.vercel.app/api/relations-scan";

interface Relation {
  name: string;
  count: number;
  sentiment: number; // +1 / 0 / -1
  trend: "improving" | "declining" | "stable";
  insight: string;
  /** 1-based indexes into the entries array sent to the scan (chronological). */
  entryIndexes: number[];
}

/** The exact entries we sent the scanner — entryIndexes map back into this. */
interface FetchedEntry {
  id: string;
  title: string | null;
  mood: string | null;
  created_at: string;
}

const TREND_EMOJI = { improving: "📈", declining: "📉", stable: "➡️" } as const;
const SENTIMENT_LABEL: Record<number, string> = { 1: "Positif", 0: "Neutre", "-1": "Tendu" };

export default function RelationsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const appFonts = useAppFonts();
  const styles = useMemo(() => makeStyles(appFonts), [appFonts]);
  const user = useAuthStore((s) => s.user);
  const t = useT();
  const [relations, setRelations] = useState<Relation[]>([]);
  const [entries, setEntries] = useState<FetchedEntry[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [hidden, setHidden] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    setScanning(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("no session");

      // Chronological (oldest first) so the scanner's "Entry N:" labels
      // (1-based) map straight back into this array.
      const { data: fetched } = await supabase
        .from("journal_entries")
        .select("id, title, mood, created_at, enhanced_text, original_transcription")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(200);

      const list = (fetched ?? []) as (FetchedEntry & {
        enhanced_text: string | null;
        original_transcription: string | null;
      })[];
      setEntries(list);

      const res = await fetch(RELATIONS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          entries: list.map((e) => ({
            id: e.id,
            text: (e.enhanced_text || e.original_transcription || "").substring(0, 400),
            mood: e.mood || "fine",
          })),
          language: "French",
        }),
      });
      if (!res.ok) throw new Error(`scan ${res.status}`);
      const json = await res.json();
      if (Array.isArray(json?.relations)) setRelations(json.relations);
    } catch (e) {
      console.warn("relations error", e);
      Alert.alert(t("profile.relations"), t("relations.scanFailed"));
    } finally {
      setLoading(false);
      setScanning(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = relations.filter((r) => !hidden.includes(r.name));
  const initials = (n: string) => n.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  const toggleExpanded = (i: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  /** Map the API's 1-based entry indexes to real entries (web parity, up to 5). */
  const sourcesFor = (r: Relation): FetchedEntry[] =>
    (r.entryIndexes ?? [])
      .map((idx) => entries[idx - 1])
      .filter((e): e is FetchedEntry => !!e)
      .slice(0, 5);

  // Web RecentEntryCard format "MMM d, EEEE" + the time Amer asked for.
  const fmtDate = (iso: string) => {
    try {
      const d = new Date(iso);
      const locale = localeFor(useSettingsStore.getState().language);
      const month = d.toLocaleDateString(locale, { month: "short" });
      const day = d.getDate();
      const weekday = d.toLocaleDateString(locale, { weekday: "long" });
      const time = d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
      return `${month} ${day}, ${weekday} · ${time}`;
    } catch {
      return iso;
    }
  };

  return (
    <LinearGradient colors={[colors.bgTop, colors.bgMid, colors.bgBottom]} style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.iconBtnText}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>💞 Relations</Text>
          <Pressable style={styles.iconBtn} onPress={load} disabled={scanning}>
            <Text style={styles.iconBtnText}>{scanning ? "…" : "↻"}</Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : visible.length === 0 ? (
          <View style={[styles.emptyCard, shadows.soft]}>
            <Text style={styles.emptyEmoji}>🔒</Text>
            <Text style={styles.emptyText}>
              {t("relations.desc")}
            </Text>
          </View>
        ) : (
          visible.map((r, i) => {
            const isOpen = expanded.has(i);
            const sources = sourcesFor(r);
            return (
              <View key={i} style={[styles.card, shadows.soft]}>
                <Pressable style={styles.topRow} onPress={() => toggleExpanded(i)}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initials(r.name)}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.name}>{r.name}</Text>
                    <Text style={styles.meta}>
                      {r.count} mention{r.count > 1 ? "s" : ""} · {SENTIMENT_LABEL[r.sentiment] ?? "Neutre"}
                    </Text>
                  </View>
                  <Text style={styles.trend}>{TREND_EMOJI[r.trend] ?? "➡️"}</Text>
                  <Text style={styles.chevron}>{isOpen ? "▾" : "▸"}</Text>
                </Pressable>
                {r.insight && <Text style={styles.insight}>{r.insight}</Text>}
                {isOpen && sources.length > 0 && (
                  <View style={styles.sourcesBox}>
                    <Text style={styles.sourcesTitle}>{t("relations.sources")}</Text>
                    {sources.map((e) => (
                      <Pressable
                        key={e.id}
                        style={styles.sourceRow}
                        onPress={() => navigation.navigate("EntryDetail", { id: e.id })}
                      >
                        <Text style={styles.sourceDate} numberOfLines={1}>
                          {fmtDate(e.created_at)}
                        </Text>
                        <Text style={styles.sourceTitle} numberOfLines={1}>
                          {e.title || t("entry.untitled")}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
                <Pressable style={styles.hideBtn} onPress={() => setHidden((h) => [...h, r.name])}>
                  <Text style={styles.hideText}>Masquer</Text>
                </Pressable>
              </View>
            );
          })
        )}

        {hidden.length > 0 && (
          <Pressable style={styles.restoreBtn} onPress={() => setHidden([])}>
            <Text style={styles.restoreText}>{t("relations.restore")}</Text>
          </Pressable>
        )}
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
  emptyCard: { ...glassCard, padding: 28, alignItems: "center" },
  emptyEmoji: { fontSize: 36, marginBottom: 10 },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: "center", lineHeight: 21, fontFamily: appFonts.body },
  card: { ...glassCard, padding: 16, marginBottom: 10 },
  topRow: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 42, height: 42, borderRadius: 999,
    backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: colors.white, fontSize: 14, fontWeight: "700", fontFamily: appFonts.bodyBold },
  name: { fontSize: 15, color: colors.text, fontFamily: appFonts.bodySemiBold },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 2, fontFamily: appFonts.body },
  trend: { fontSize: 22 },
  chevron: { fontSize: 16, color: colors.textFaint, marginLeft: 8, fontFamily: appFonts.body },
  insight: { fontSize: 13, color: colors.text, lineHeight: 20, marginTop: 12, fontFamily: appFonts.body },
  sourcesBox: {
    marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.glassBorder,
  },
  sourcesTitle: {
    fontSize: 11, color: colors.textFaint, textTransform: "uppercase",
    letterSpacing: 0.6, marginBottom: 8, fontFamily: appFonts.bodyMedium,
  },
  sourceRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10,
    backgroundColor: colors.cardGlassStrong, marginBottom: 6,
  },
  sourceDate: { fontSize: 12, color: colors.primary, fontFamily: appFonts.bodySemiBold, flexShrink: 1 },
  sourceTitle: { fontSize: 13, color: colors.text, fontFamily: appFonts.body, marginLeft: 8, flexShrink: 1 },
  hideBtn: { marginTop: 10, alignSelf: "flex-end" },
  hideText: { fontSize: 12, color: colors.textFaint, fontFamily: appFonts.bodyMedium },
  restoreBtn: { alignItems: "center", paddingVertical: 14 },
  restoreText: { fontSize: 13, color: colors.primary, fontFamily: appFonts.bodySemiBold },
});
