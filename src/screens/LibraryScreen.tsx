import { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, fonts } from "@/theme";
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

export default function LibraryScreen() {
  const user = useAuthStore((s) => s.user);
  const t = useT();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data }, { count }] = await Promise.all([
      supabase
        .from("journal_entries")
        .select("id, title, mood, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("journal_entries")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
    ]);
    if (data) setEntries(data);
    if (count != null) setCount(count);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

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
          <View style={styles.headerRow}>
            <Text style={styles.title}>📚 {t("nav.library")}</Text>
            {count != null && <Text style={styles.count}>{t("library.entries").replace("{count}", String(count))}</Text>}
          </View>
        }
        renderItem={({ item }) => <EntryCard entry={item} />}
        ListEmptyComponent={<Text style={styles.empty}>{t("library.empty")}</Text>}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, paddingBottom: 110 },
  headerRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 },
  title: {
    fontSize: 26,
    color: colors.text,
    fontFamily: fonts.displayBold,
  },
  count: { fontSize: 13, color: colors.textMuted, fontFamily: fonts.bodyMedium },
  empty: { color: colors.textMuted, fontSize: 14, textAlign: "center", marginTop: 24, fontFamily: fonts.body },
});
