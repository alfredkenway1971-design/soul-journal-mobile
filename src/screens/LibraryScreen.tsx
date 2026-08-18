import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl, Pressable, TextInput } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme";
import { useAppFonts, type AppFonts } from "@/hooks/useAppFonts";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { useT } from "@/store/settingsStore";
import EntryCard from "@/components/EntryCard";
import MoodFilterBar, { type MoodFilterValue } from "@/components/MoodFilterBar";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";

const PAGE_SIZE = 20;

interface Entry {
  id: string;
  title: string | null;
  mood: string | null;
  created_at: string;
  enhanced_text?: string | null;
  original_transcription?: string | null;
  duration_seconds?: number | null;
}

export default function LibraryScreen() {
  const user = useAuthStore((s) => s.user);
  const appFonts = useAppFonts();
  const styles = useMemo(() => makeStyles(appFonts), [appFonts]);
  const t = useT();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [moodFilter, setMoodFilter] = useState<MoodFilterValue>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchEntries = useCallback(async (offset = 0) => {
    if (!user) return;
    const { count } = await supabase
      .from("journal_entries")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    setCount(count ?? null);

    const { data, error } = await supabase
      .from("journal_entries")
      .select("id, title, mood, created_at, enhanced_text, original_transcription, duration_seconds")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    return { data: data || [], hasMore: (data?.length || 0) >= PAGE_SIZE };
  }, [user]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchEntries(0);
      if (res) {
        setEntries(res.data);
        setHasMore(res.hasMore);
      }
    } catch (e) {
      console.warn("library load error", e);
    } finally {
      setLoading(false);
    }
  }, [fetchEntries]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = async () => {
    if (!user || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetchEntries(entries.length);
      if (res) {
        setEntries((prev) => [...prev, ...res.data]);
        setHasMore(res.hasMore);
      }
    } catch (e) {
      console.warn("library load-more error", e);
    } finally {
      setLoadingMore(false);
    }
  };

  const hasFilters = moodFilter !== "all" || searchQuery.trim().length > 0;

  const filteredEntries = useMemo(() => {
    let result = entries;
    if (moodFilter !== "all") {
      result = result.filter((e) => (e.mood || "").toLowerCase() === moodFilter);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (e) =>
          e.title?.toLowerCase().includes(q) ||
          e.enhanced_text?.toLowerCase().includes(q) ||
          e.original_transcription?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [entries, moodFilter, searchQuery]);

  const clearFilters = () => {
    setMoodFilter("all");
    setSearchQuery("");
  };

  return (
    <LinearGradient colors={[colors.bgTop, colors.bgMid, colors.bgBottom]} style={styles.root}>
      <FlatList
        data={filteredEntries}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.headerRow}>
              <Text style={styles.title}>{t("nav.library")}</Text>
            </View>

            {/* Mood filter — above search (web parity) */}
            <View style={styles.filterBlock}>
              <MoodFilterBar value={moodFilter} onChange={setMoodFilter} />
            </View>

            {/* Glass search pill */}
            <View style={[styles.searchPill, styles.glassCard]}>
              <Ionicons name="search" size={18} color="#64748b" />
              <TextInput
                style={styles.searchInput}
                placeholder={t("common.search")}
                placeholderTextColor="#94a3b8"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
              />
              <Pressable style={styles.calendarBtn} onPress={() => navigation.navigate("Calendar")}>
                <Ionicons name="calendar-outline" size={18} color={colors.primary} />
              </Pressable>
            </View>

            {hasFilters && (
              <View style={styles.filterActions}>
                <Pressable onPress={clearFilters}>
                  <Text style={styles.clearAll}>{t("common.clearAll")}</Text>
                </Pressable>
              </View>
            )}

            {count != null && !loading && (
              <Text style={styles.count}>{t("library.entries").replace("{count}", String(count))}</Text>
            )}
            <View style={styles.divider} />
          </View>
        }
        renderItem={({ item }) => <EntryCard entry={item} />}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>📝</Text>
              <Text style={styles.empty}>
                {hasFilters ? t("library.noneFound") : t("library.empty")}
              </Text>
              {hasFilters && (
                <Pressable style={styles.emptyBtn} onPress={clearFilters}>
                  <Text style={styles.emptyBtnText}>{t("common.clearFilters")}</Text>
                </Pressable>
              )}
            </View>
          )
        }
        ListFooterComponent={
          hasMore && filteredEntries.length > 0 ? (
            <Pressable style={styles.loadMore} onPress={loadMore} disabled={loadingMore}>
              <Text style={styles.loadMoreText}>
                {loadingMore ? t("library.loadingMore") : t("library.loadMore")}
              </Text>
            </Pressable>
          ) : null
        }
      />
    </LinearGradient>
  );
}

const makeStyles = (appFonts: AppFonts) =>
  StyleSheet.create({
    root: { flex: 1 },
    content: { padding: 20, paddingBottom: 110 },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 14,
    },
    title: {
      fontSize: 28,
      color: "#1e293b",
      fontFamily: appFonts.displayBold,
    },
    filterBlock: { marginBottom: 12 },
    glassCard: {
      backgroundColor: "rgba(255,255,255,0.7)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.7)",
    },
    searchPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderRadius: 999,
      paddingHorizontal: 16,
      paddingVertical: 10,
      marginBottom: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: "#1e293b",
      fontFamily: appFonts.body,
      paddingVertical: 0,
    },
    calendarBtn: { padding: 2 },
    filterActions: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 8 },
    clearAll: { fontSize: 12, color: "#64748b", fontFamily: appFonts.bodyMedium },
    count: {
      fontSize: 13,
      color: "#94a3b8",
      marginTop: 6,
      marginBottom: 10,
      fontFamily: appFonts.bodyMedium,
    },
    divider: {
      borderTopWidth: 1,
      borderTopColor: "rgba(148,163,184,0.25)",
      marginBottom: 16,
    },
    emptyCard: {
      backgroundColor: "rgba(255,255,255,0.75)",
      borderRadius: 18,
      padding: 28,
      alignItems: "center",
      borderWidth: 1,
      borderColor: "#e2e8f0",
    },
    emptyEmoji: { fontSize: 32, marginBottom: 10 },
    empty: { color: "#64748b", fontSize: 14, textAlign: "center", fontFamily: appFonts.body },
    emptyBtn: {
      backgroundColor: colors.primary,
      borderRadius: 999,
      paddingHorizontal: 20,
      paddingVertical: 10,
      marginTop: 14,
    },
    emptyBtnText: { color: "#ffffff", fontSize: 13, fontWeight: "700", fontFamily: appFonts.bodyBold },
    loadMore: { alignItems: "center", paddingVertical: 14 },
    loadMoreText: { fontSize: 14, color: colors.primary, fontFamily: appFonts.bodySemiBold },
  });
