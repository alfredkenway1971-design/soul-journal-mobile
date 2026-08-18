import { useCallback, useEffect, useState, useMemo } from "react";
import {
  View, Text, Pressable, StyleSheet, ScrollView, Alert, ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { colors, radius, fonts, glassCard, shadows } from "@/theme";
import { useAppFonts, type AppFonts } from "@/hooks/useAppFonts";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { useT, useSettingsStore } from "@/store/settingsStore";
import { useSubscriptionStore } from "@/store/subscriptionStore";
import UpgradePrompt from "@/components/UpgradePrompt";

const SOUL_MIRROR_URL = "https://soul-journal-seven.vercel.app/api/soul-mirror";

interface Portrait {
  emotionalSummary?: { dominantMoods?: string[]; text?: string };
  hiddenPatterns?: string;
  goalProgress?: { goal?: string; status?: string }[];
  sourcesOfJoy?: string[];
  growthArea?: string;
  lifeChapter?: string;
}

const monthLabel = (d: Date, lang: string) =>
  d.toLocaleDateString(lang === "ar" ? "ar" : lang === "zh" ? "zh-CN" : lang === "ja" ? "ja-JP" : `${lang}-CA`, {
    month: "long",
    year: "numeric",
  });

export default function SoulMirrorScreen() {
  const navigation = useNavigation();
  const appFonts = useAppFonts();
  const styles = useMemo(() => makeStyles(appFonts), [appFonts]);
  const user = useAuthStore((s) => s.user);
  const t = useT();
  const language = useSettingsLang();
  const isPremium = useSubscriptionStore((s) => s.isPremium);

  const [months, setMonths] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [portrait, setPortrait] = useState<Portrait | null>(null);
  const [loading, setLoading] = useState(false);

  // build last 6 months (YYYY-MM)
  useEffect(() => {
    const list: string[] = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      list.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    setMonths(list);
    setSelected(list[0]);
  }, []);

  const cacheKey = `sj-soul-mirror-${selected}`;

  const generate = useCallback(async () => {
    if (!user || !selected) return;
    // cached portrait first
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        setPortrait(JSON.parse(cached));
        return;
      }
    } catch {}
    setLoading(true);
    setPortrait(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("no session");

      const { data: entries } = await supabase
        .from("journal_entries")
        .select("title, enhanced_text, original_transcription, mood, created_at")
        .eq("user_id", user.id)
        .gte("created_at", `${selected}-01T00:00:00`)
        .lt("created_at", `${selected}-31T23:59:59`)
        .order("created_at", { ascending: true })
        .limit(60);

      const { data: profile } = await supabase
        .from("profiles")
        .select("goals")
        .eq("id", user.id)
        .maybeSingle();

      const goals = Array.isArray(profile?.goals) ? (profile.goals as { title: string }[]).map((g) => g.title) : [];
      const langName = { en: "English", fr: "French", es: "Spanish", ar: "Arabic", zh: "Chinese", ja: "Japanese", sw: "Swahili", de: "German" }[language] ?? "French";

      const res = await fetch(SOUL_MIRROR_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          month: selected,
          entries: (entries ?? []).map((e) => ({
            text: (e.enhanced_text || e.original_transcription || "").substring(0, 800),
            mood: e.mood || "fine",
            created_at: e.created_at,
          })),
          goals,
          language: langName,
        }),
      });
      if (!res.ok) throw new Error(`mirror ${res.status}`);
      const json = await res.json();
      if (json?.empty) {
        setPortrait({ emotionalSummary: { text: "No entries this month." } });
        return;
      }
      if (!json?.portrait) throw new Error("no portrait");
      setPortrait(json.portrait);
      try {
        await AsyncStorage.setItem(cacheKey, JSON.stringify(json.portrait));
      } catch {}
    } catch (e) {
      console.warn("soul mirror error", e);
      Alert.alert("Soul Mirror", "Impossible de générer le portrait. Réessayez.");
    } finally {
      setLoading(false);
    }
  }, [user, selected, cacheKey, language]);

  useEffect(() => {
    if (selected && isPremium) generate();
  }, [selected, generate, isPremium]);

  const moods = portrait?.emotionalSummary?.dominantMoods ?? [];

  return (
    <LinearGradient colors={[colors.bgTop, colors.bgMid, colors.bgBottom]} style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.iconBtnText}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>🪞 Soul Mirror</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Month chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.monthScroller} contentContainerStyle={styles.monthRow}>
          {months.map((m) => {
            const d = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 1);
            const active = m === selected;
            return (
              <Pressable
                key={m}
                style={[styles.monthChip, active && styles.monthChipActive]}
                onPress={() => setSelected(m)}
              >
                <Text style={[styles.monthChipText, active && { color: colors.primary, fontWeight: "700" }]}>
                  {monthLabel(d, language)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Premium gate */}
        {!isPremium ? (
          <UpgradePrompt
            title="Soul Mirror est une fonction Premium"
            description="Découvrez votre portrait mensuel — émotions dominantes, schémas cachés, sources de joie et domaine de croissance."
          />
        ) : loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.loadingText}>Création de votre portrait…</Text>
          </View>
        ) : portrait ? (
          <View style={[styles.portraitCard, shadows.card]}>
            {portrait.lifeChapter && (
              <Text style={styles.chapter}>« {portrait.lifeChapter} »</Text>
            )}

            {moods.length > 0 && (
              <View style={styles.moodRowWrap}>
                {moods.map((m, i) => (
                  <View key={i} style={styles.moodPill}>
                    <Text style={styles.moodPillText}>{m}</Text>
                  </View>
                ))}
              </View>
            )}

            {portrait.emotionalSummary?.text && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>💭 Résumé émotionnel</Text>
                <Text style={styles.sectionText}>{portrait.emotionalSummary.text}</Text>
              </View>
            )}

            {portrait.hiddenPatterns && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🔍 Schémas cachés</Text>
                <Text style={styles.sectionText}>{portrait.hiddenPatterns}</Text>
              </View>
            )}

            {portrait.goalProgress && portrait.goalProgress.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🎯 Progrès des objectifs</Text>
                {portrait.goalProgress.map((g, i) => (
                  <Text key={i} style={styles.sectionText}>• {g.goal}: {g.status}</Text>
                ))}
              </View>
            )}

            {portrait.sourcesOfJoy && portrait.sourcesOfJoy.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>💜 Sources de joie</Text>
                {portrait.sourcesOfJoy.map((s, i) => (
                  <Text key={i} style={styles.sectionText}>• {s}</Text>
                ))}
              </View>
            )}

            {portrait.growthArea && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🌱 Domaine de croissance</Text>
                <Text style={styles.sectionText}>{portrait.growthArea}</Text>
              </View>
            )}

            <Pressable style={styles.regenerateBtn} onPress={async () => {
              try { await AsyncStorage.removeItem(cacheKey); } catch {}
              setPortrait(null);
              generate();
            }}>
              <Text style={styles.regenerateText}>🔄 Régénérer</Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={styles.disclaimer}>
          Cette analyse est basée sur vos entrées, pas un diagnostic médical.
        </Text>
      </ScrollView>
    </LinearGradient>
  );
}

// small hook wrapper to read language from settings store
function useSettingsLang() {
  return useSettingsStore((s) => s.language);
}

const makeStyles = (appFonts: AppFonts) => StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
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
  iconBtnText: { fontSize: 20, color: colors.primary, fontFamily: appFonts.bodyBold },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 18, color: colors.text, fontFamily: appFonts.displayBold },
  monthScroller: { marginBottom: 18 },
  monthRow: { gap: 8, paddingRight: 8 },
  monthChip: {
    backgroundColor: colors.cardGlass,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  monthChipActive: { borderColor: colors.primary, backgroundColor: colors.white },
  monthChipText: { fontSize: 13, color: colors.textMuted, fontFamily: appFonts.bodyMedium },
  loadingBox: { alignItems: "center", paddingVertical: 60, gap: 12 },
  loadingText: { color: colors.textMuted, fontSize: 14, fontFamily: appFonts.body },
  portraitCard: {
    ...glassCard,
    padding: 22,
  },
  chapter: {
    fontSize: 19,
    color: colors.primary,
    fontFamily: appFonts.displayBold,
    textAlign: "center",
    marginBottom: 14,
    lineHeight: 26,
  },
  moodRowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 16 },
  moodPill: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  moodPillText: { fontSize: 12, color: colors.primary, fontFamily: appFonts.bodySemiBold },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 14, color: colors.text, fontFamily: appFonts.display, marginBottom: 6 },
  sectionText: { fontSize: 14, lineHeight: 21, color: colors.text, fontFamily: appFonts.body },
  regenerateBtn: {
    marginTop: 8,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.white,
  },
  regenerateText: { color: colors.primary, fontSize: 14, fontWeight: "600", fontFamily: appFonts.bodySemiBold },
  disclaimer: {
    fontSize: 11,
    color: colors.textFaint,
    textAlign: "center",
    marginTop: 16,
    fontFamily: appFonts.body,
  },
});
