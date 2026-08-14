import { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "@/theme";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import EntryCard from "@/components/EntryCard";

interface Entry {
  id: string;
  title: string | null;
  mood: string | null;
  created_at: string;
}

export default function LibraryScreen() {
  const user = useAuthStore((s) => s.user);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("journal_entries")
      .select("id, title, mood, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setEntries(data);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <LinearGradient colors={[colors.bgTop, colors.bgBottom]} style={styles.root}>
      <FlatList
        data={entries}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.primary} />
        }
        ListHeaderComponent={<Text style={styles.title}>📚 Bibliothèque</Text>}
        renderItem={({ item }) => <EntryCard entry={item} />}
        ListEmptyComponent={<Text style={styles.empty}>Aucune entrée pour l'instant.</Text>}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, paddingBottom: 100 },
  title: { fontSize: 26, fontWeight: "700", color: colors.text, marginBottom: 16 },
  empty: { color: colors.textMuted, fontSize: 14, textAlign: "center", marginTop: 24 },
});
