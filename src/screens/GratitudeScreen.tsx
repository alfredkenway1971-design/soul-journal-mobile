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
import { useT } from "@/store/settingsStore";

const GRATITUDE_URL = "https://soul-journal-seven.vercel.app/api/gratitude-scan";

interface GratitudeItem {
  gratitude: string;
  category: string;
  entryIndexes: number[];
}

const CATEGORY_EMOJI: Record<string, string> = {
  people: "👥", experiences: "🎉", small_moments: "✨", achievements: "🏆", other: "🌸",
};

export default function GratitudeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const appFonts = useAppFonts();
  const styles = useMemo(() => makeStyles(appFonts), [appFonts]);
  const user = useAuthStore((s) => s.user);
  const t = useT();
  const [items, setItems] = useState<GratitudeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [entryIds, setEntryIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    setScanning(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("no session");

      const { data: entries } = await supabase
        .from("journal_entries")
        .select("id, enhanced_text, original_transcription")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200);

      const ids = (entries ?? []).map((e) => e.id);
      setEntryIds(ids);

      const res = await fetch(GRATITUDE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          entries: (entries ?? []).map((e) => ({
            id: e.id,
            text: (e.enhanced_text || e.original_transcription || "").substring(0, 500),
          })),
        }),
      });
      if (!res.ok) throw new Error(`scan ${res.status}`);
      const json = await res.json();
      if (Array.isArray(json?.items)) setItems(json.items);
    } catch (e) {
      console.warn("gratitude error", e);
      Alert.alert("Gratitude", "Impossible d'analyser. Réessayez.");
    } finally {
      setLoading(false);
      setScanning(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Group by category
  const byCat = new Map<string, GratitudeItem[]>();
  for (const it of items) {
    const cat = it.category || "other";
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat)!.push(it);
  }

  return (
    <LinearGradient colors={[colors.bgTop, colors.bgMid, colors.bgBottom]} style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.iconBtnText}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>💛 Gratitude</Text>
          <Pressable style={styles.iconBtn} onPress={load} disabled={scanning}>
            <Text style={styles.iconBtnText}>{scanning ? "…" : "↻"}</Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : items.length === 0 ? (
          <View style={[styles.emptyCard, shadows.soft]}>
            <Text style={styles.emptyEmoji}>🌱</Text>
            <Text style={styles.emptyText}>
              L'IA détecte les moments de gratitude dans vos entrées — écrivez sur ce dont vous êtes reconnaissant.
            </Text>
          </View>
        ) : (
          Array.from(byCat.entries()).map(([cat, list]) => (
            <View key={cat} style={styles.catBlock}>
              <Text style={styles.catTitle}>
                {CATEGORY_EMOJI[cat] ?? "🌸"} {cat.replace("_", " ")}
              </Text>
              {list.map((it, i) => (
                <View key={i} style={[styles.itemCard, shadows.soft]}>
                  <Text style={styles.itemText}>💛 {it.gratitude}</Text>
                  <Text style={styles.itemCount}>
                    {it.entryIndexes?.length ?? 1} mention{(it.entryIndexes?.length ?? 1) > 1 ? "s" : ""}
                  </Text>
                </View>
              ))}
            </View>
          ))
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
  catBlock: { marginBottom: 16 },
  catTitle: {
    fontSize: 14,
    color: colors.primary,
    fontFamily: appFonts.bodySemiBold,
    textTransform: "capitalize",
    marginBottom: 8,
  },
  itemCard: { ...glassCard, padding: 14, marginBottom: 8 },
  itemText: { fontSize: 14, color: colors.text, lineHeight: 20, fontFamily: appFonts.body },
  itemCount: { fontSize: 11, color: colors.textFaint, marginTop: 6, fontFamily: appFonts.bodyMedium },
});
