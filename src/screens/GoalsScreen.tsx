import { useCallback, useEffect, useState } from "react";
import {
  View, Text, Pressable, StyleSheet, ScrollView, Alert, TextInput, ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { colors, radius, fonts, glassCard, shadows } from "@/theme";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { useT } from "@/store/settingsStore";

interface Goal {
  id: string;
  title: string;
  category: string;
  icon: string;
}

const GOAL_SCAN_URL = "https://soul-journal-seven.vercel.app/api/goal-scan";
const GOAL_CATEGORIES = ["Santé", "Carrière", "Finances", "Relations", "Croissance", "Autre"];

export default function GoalsScreen() {
  const navigation = useNavigation();
  const user = useAuthStore((s) => s.user);
  const t = useT();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState(GOAL_CATEGORIES[0]);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ goal: string; count: number; status: string }[] | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("goals")
      .eq("id", user.id)
      .maybeSingle();
    if (Array.isArray(data?.goals)) setGoals(data.goals as Goal[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const saveGoals = async (next: Goal[]) => {
    if (!user) return;
    await supabase.from("profiles").update({ goals: next }).eq("id", user.id);
  };

  const addGoal = async () => {
    const title = newTitle.trim();
    if (!title) return;
    const goal: Goal = {
      id: `${Date.now()}`,
      title,
      category: newCategory,
      icon: "🎯",
    };
    const next = [...goals, goal];
    setGoals(next);
    await saveGoals(next);
    setNewTitle("");
    setAdding(false);
  };

  const removeGoal = (id: string) => {
    const next = goals.filter((g) => g.id !== id);
    setGoals(next);
    saveGoals(next);
  };

  const runScan = async () => {
    if (!user || goals.length === 0) return;
    setScanning(true);
    setScanResult(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("no session");

      const { data: entries } = await supabase
        .from("journal_entries")
        .select("title, enhanced_text, original_transcription")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      const res = await fetch(GOAL_SCAN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          goals: goals.map((g) => g.title),
          entries: (entries ?? []).map((e) => (e.enhanced_text || e.original_transcription || "").substring(0, 500)),
        }),
      });
      if (!res.ok) throw new Error(`scan ${res.status}`);
      const json = await res.json();
      if (Array.isArray(json?.results)) setScanResult(json.results);
    } catch (e) {
      console.warn("goal scan error", e);
      Alert.alert("Goal scan", "Impossible d'analyser vos objectifs. Réessayez.");
    } finally {
      setScanning(false);
    }
  };

  return (
    <LinearGradient colors={[colors.bgTop, colors.bgMid, colors.bgBottom]} style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.iconBtnText}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>🎯 {t("profile.objectives")}</Text>
          <Pressable style={styles.iconBtn} onPress={() => setAdding((v) => !v)}>
            <Text style={styles.iconBtnText}>＋</Text>
          </Pressable>
        </View>

        {adding && (
          <View style={[styles.addCard, shadows.soft]}>
            <TextInput
              style={styles.input}
              placeholder="Nouvel objectif…"
              placeholderTextColor={colors.textFaint}
              value={newTitle}
              onChangeText={setNewTitle}
            />
            <View style={styles.catRow}>
              {GOAL_CATEGORIES.map((c) => (
                <Pressable
                  key={c}
                  style={[styles.catChip, newCategory === c && styles.catChipActive]}
                  onPress={() => setNewCategory(c)}
                >
                  <Text style={[styles.catChipText, newCategory === c && { color: colors.primary, fontWeight: "700" }]}>
                    {c}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={styles.addBtn} onPress={addGoal}>
              <Text style={styles.addBtnText}>Ajouter</Text>
            </Pressable>
          </View>
        )}

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : goals.length === 0 ? (
          <View style={[styles.emptyCard, shadows.soft]}>
            <Text style={styles.emptyEmoji}>🎯</Text>
            <Text style={styles.emptyText}>
              Ajoutez vos objectifs — l'IA analyse vos entrées pour suivre vos progrès.
            </Text>
          </View>
        ) : (
          <>
            {goals.map((g) => (
              <View key={g.id} style={[styles.goalCard, shadows.soft]}>
                <Text style={styles.goalIcon}>{g.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.goalTitle}>{g.title}</Text>
                  <Text style={styles.goalCat}>{g.category}</Text>
                </View>
                <Pressable onPress={() => removeGoal(g.id)} hitSlop={8}>
                  <Text style={styles.goalDelete}>✕</Text>
                </Pressable>
              </View>
            ))}

            <Pressable style={[styles.scanBtn, shadows.soft, scanning && { opacity: 0.6 }]} onPress={runScan} disabled={scanning}>
              {scanning ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.scanBtnText}>✨ Analyser mes progrès (IA)</Text>
              )}
            </Pressable>

            {scanResult && (
              <View style={[styles.resultCard, shadows.card]}>
                <Text style={styles.resultTitle}>Progrès récents</Text>
                {scanResult.map((r, i) => (
                  <View key={i} style={styles.resultRow}>
                    <Text style={styles.resultGoal}>{r.goal}</Text>
                    <Text style={styles.resultCount}>
                      {r.count > 0 ? `📈 ${r.count} mention${r.count > 1 ? "s" : ""}` : "📭 pas encore"}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: colors.cardGlassStrong,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  iconBtnText: { fontSize: 20, color: colors.primary, fontFamily: fonts.bodyBold },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 18, color: colors.text, fontFamily: fonts.displayBold },
  addCard: {
    ...glassCard,
    padding: 16,
    marginBottom: 16,
  },
  input: {
    backgroundColor: colors.white,
    borderRadius: radius.input,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    fontFamily: fonts.body,
    marginBottom: 12,
  },
  catRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  catChip: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "transparent",
  },
  catChipActive: { borderColor: colors.primary, backgroundColor: colors.white },
  catChipText: { fontSize: 12, color: colors.textMuted, fontFamily: fonts.body },
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.input,
    paddingVertical: 12,
    alignItems: "center",
  },
  addBtnText: { color: colors.white, fontSize: 15, fontWeight: "700", fontFamily: fonts.bodyBold },
  emptyCard: {
    ...glassCard,
    padding: 28,
    alignItems: "center",
  },
  emptyEmoji: { fontSize: 36, marginBottom: 10 },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: "center", lineHeight: 21, fontFamily: fonts.body },
  goalCard: {
    ...glassCard,
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    marginBottom: 10,
  },
  goalIcon: { fontSize: 22, marginRight: 12 },
  goalTitle: { fontSize: 15, color: colors.text, fontFamily: fonts.bodySemiBold },
  goalCat: { fontSize: 12, color: colors.textMuted, marginTop: 2, fontFamily: fonts.body },
  goalDelete: { fontSize: 16, color: colors.textFaint, paddingHorizontal: 6 },
  scanBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.input,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 8,
  },
  scanBtnText: { color: colors.white, fontSize: 15, fontWeight: "700", fontFamily: fonts.bodyBold },
  resultCard: {
    ...glassCard,
    padding: 18,
    marginTop: 16,
  },
  resultTitle: { fontSize: 15, color: colors.text, fontFamily: fonts.display, marginBottom: 10 },
  resultRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  resultGoal: { fontSize: 14, color: colors.text, fontFamily: fonts.bodyMedium, flex: 1 },
  resultCount: { fontSize: 13, color: colors.textMuted, fontFamily: fonts.body },
});
