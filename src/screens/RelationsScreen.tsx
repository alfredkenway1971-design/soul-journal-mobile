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

const RELATIONS_URL = "https://soul-journal-seven.vercel.app/api/relations-scan";

interface Relation {
  name: string;
  count: number;
  sentiment: number; // +1 / 0 / -1
  trend: "improving" | "declining" | "stable";
  insight: string;
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

      const { data: entries } = await supabase
        .from("journal_entries")
        .select("id, enhanced_text, original_transcription, mood")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(200);

      const res = await fetch(RELATIONS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          entries: (entries ?? []).map((e) => ({
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
      Alert.alert("Relations", "Impossible d'analyser. Réessayez.");
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
              L'IA suit les personnes importantes dans vos entrées — vos relations restent privées, visibles seulement par vous.
            </Text>
          </View>
        ) : (
          visible.map((r, i) => (
            <View key={i} style={[styles.card, shadows.soft]}>
              <View style={styles.topRow}>
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
              </View>
              {r.insight && <Text style={styles.insight}>{r.insight}</Text>}
              <Pressable style={styles.hideBtn} onPress={() => setHidden((h) => [...h, r.name])}>
                <Text style={styles.hideText}>Masquer</Text>
              </Pressable>
            </View>
          ))
        )}

        {hidden.length > 0 && (
          <Pressable style={styles.restoreBtn} onPress={() => setHidden([])}>
            <Text style={styles.restoreText}>Restaurer les relations masquées</Text>
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
  insight: { fontSize: 13, color: colors.text, lineHeight: 20, marginTop: 12, fontFamily: appFonts.body },
  hideBtn: { marginTop: 10, alignSelf: "flex-end" },
  hideText: { fontSize: 12, color: colors.textFaint, fontFamily: appFonts.bodyMedium },
  restoreBtn: { alignItems: "center", paddingVertical: 14 },
  restoreText: { fontSize: 13, color: colors.primary, fontFamily: appFonts.bodySemiBold },
});
