import { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, radius } from "@/theme";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import EntryCard from "@/components/EntryCard";

interface Entry {
  id: string;
  title: string | null;
  mood: string | null;
  created_at: string;
}

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: profile }, { data: rows }] = await Promise.all([
      supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
      supabase
        .from("journal_entries")
        .select("id, title, mood, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
    if (profile?.display_name) setDisplayName(profile.display_name);
    if (rows) setEntries(rows);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const firstName = displayName?.split(" ")[0] || user?.email?.split("@")[0] || "";

  return (
    <LinearGradient colors={[colors.bgTop, colors.bgBottom]} style={styles.root}>
      <FlatList
        data={entries}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <View>
            <Text style={styles.hello}>Bonjour {firstName} ✨</Text>
            <Text style={styles.subtitle}>Comment allez-vous aujourd'hui ?</Text>

            <Pressable style={styles.quickCard} onPress={() => {}}>
              <Text style={styles.quickEmoji}>🎙️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.quickTitle}>Enregistrer une entrée</Text>
                <Text style={styles.quickDesc}>Parlez librement — l'IA transcrit et organise</Text>
              </View>
              <Text style={styles.quickArrow}>→</Text>
            </Pressable>

            <Text style={styles.sectionTitle}>Vos dernières entrées</Text>
          </View>
        }
        renderItem={({ item }) => <EntryCard entry={item} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Aucune entrée pour l'instant. Appuyez sur 🎙️ pour écrire votre première pensée.
          </Text>
        }
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, paddingBottom: 100 },
  hello: { fontSize: 28, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 15, color: colors.textMuted, marginTop: 4, marginBottom: 20 },
  quickCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
  },
  quickEmoji: { fontSize: 26, marginRight: 12 },
  quickTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
  quickDesc: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  quickArrow: { fontSize: 18, color: colors.primary, fontWeight: "700" },
  sectionTitle: { fontSize: 17, fontWeight: "600", color: colors.text, marginBottom: 10 },
  empty: { color: colors.textMuted, fontSize: 14, textAlign: "center", marginTop: 24 },
});
