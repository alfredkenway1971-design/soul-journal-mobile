import { useCallback, useEffect, useState, useMemo } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Alert, ActivityIndicator, Share } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Print from "expo-print";
import * as FileSystem from "expo-file-system/legacy";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { colors, radius, fonts, glassCard, shadows } from "@/theme";
import { useAppFonts, type AppFonts } from "@/hooks/useAppFonts";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { useSubscriptionStore } from "@/store/subscriptionStore";
import { useT, useSettingsStore, localeFor } from "@/store/settingsStore";
import UpgradePrompt from "@/components/UpgradePrompt";

const COVERS = [
  { id: "nebula", labelKey: "book.cover", from: "#1e3a5f", to: "#7c3aed" },
  { id: "minimalist", labelKey: "book.coverMinimalist", from: "#f8fafc", to: "#cbd5e1" },
  { id: "botanical", labelKey: "book.coverBotanical", from: "#064e3b", to: "#10b981" },
  { id: "sunrise", labelKey: "book.coverSunrise", from: "#7c2d12", to: "#f59e0b" },
] as const;

const MOOD_EMOJI: Record<string, string> = { happy: "😊", good: "😇", fine: "😌", sad: "😔", unhappy: "😢" };

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>");

export default function BookBuilderScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const t = useT();
  const appFonts = useAppFonts();
  const styles = useMemo(() => makeStyles(appFonts), [appFonts]);
  const user = useAuthStore((s) => s.user);
  const isPremium = useSubscriptionStore((s) => s.isPremium);
  const [cover, setCover] = useState<(typeof COVERS)[number]["id"]>("nebula");
  const [count, setCount] = useState(0);
  const [building, setBuilding] = useState(false);
  const [progress, setProgress] = useState("");

  const loadCount = useCallback(async () => {
    if (!user) return;
    const { count: c } = await supabase
      .from("journal_entries")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    setCount(c ?? 0);
  }, [user]);

  useEffect(() => {
    loadCount();
  }, [loadCount]);

  const buildBook = async () => {
    if (!user) return;
    setBuilding(true);
    setProgress(t("book.loading"));
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();
      const authorName = profile?.display_name || user.email?.split("@")[0] || "Soul Journal";

      const { data: entries } = await supabase
        .from("journal_entries")
        .select("title, mood, created_at, enhanced_text, original_transcription")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (!entries || entries.length === 0) {
        Alert.alert(t("book.empty"), t("book.noEntriesBody"));
        setBuilding(false);
        return;
      }

      setProgress(t("book.composing"));
      const c = COVERS.find((x) => x.id === cover)!;
      const yearRange = entries.length > 0
        ? `${new Date(entries[0].created_at).getFullYear()} — ${new Date(entries[entries.length - 1].created_at).getFullYear()}`
        : "";

      const entryCards = entries
        .map((e, i) => {
          const text = (e.enhanced_text || e.original_transcription || "").substring(0, 1200);
          const d = new Date(e.created_at);
          const date = d.toLocaleDateString(localeFor(useSettingsStore.getState().language), { day: "numeric", month: "long", year: "numeric" });
          return `
            <div class="entry">
              <div class="entry-head">
                <span class="mood">${MOOD_EMOJI[e.mood ?? ""] ?? "📝"}</span>
                <span class="title">${escapeHtml(e.title || t("book.entryFallback").replace("{n}", String(i + 1)))}</span>
              </div>
              <div class="date">${date}</div>
              <div class="body">${escapeHtml(text || "")}</div>
            </div>`;
        })
        .join("");

      const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Georgia, 'Times New Roman', serif; color: #1f2937; }
  .cover {
    height: 100vh; width: 100%;
    background: linear-gradient(160deg, ${c.from} 0%, ${c.to} 100%);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    color: #fff; text-align: center; page-break-after: always;
  }
  .cover .brand { font-size: 14px; letter-spacing: 4px; opacity: .8; text-transform: uppercase; margin-bottom: 20px; }
  .cover h1 { font-size: 44px; margin: 0 40px; line-height: 1.2; font-weight: normal; }
  .cover .author { margin-top: 24px; font-size: 16px; opacity: .9; }
  .cover .years { margin-top: 8px; font-size: 13px; opacity: .7; }
  .entry {
    padding: 36px 48px;
    page-break-after: always;
  }
  .entry-head { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
  .mood { font-size: 22px; }
  .title { font-size: 22px; font-weight: bold; color: #111827; }
  .date { font-size: 12px; color: #6b7280; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 1px; }
  .body { font-size: 14px; line-height: 1.8; }
  .footer { page-break-after: always; display: flex; align-items: center; justify-content: center; height: 100vh; color: #9ca3af; }
</style>
</head>
<body>
  <div class="cover">
    <div class="brand">Soul Journal</div>
    <h1>${escapeHtml(authorName)}</h1>
    <div class="author">${t("book.title")}</div>
    <div class="years">${yearRange}</div>
  </div>
  ${entryCards}
  <div class="footer">${t("book.footerLine")}</div>
</body>
</html>`;

      setProgress(t("book.generating"));
      const { uri } = await Print.printToFileAsync({ html });
      const out = `${FileSystem.cacheDirectory}soul-journal-${Date.now()}.pdf`;
      await FileSystem.copyAsync({ from: uri, to: out });
      setBuilding(false);
      try {
        await Share.share({ url: out, message: t("book.shareMsg") });
      } catch {
        Alert.alert(t("book.ready"), t("book.readyBody").replace("{count}", String(entries.length)));
      }
    } catch (e) {
      console.warn("book error", e);
      Alert.alert(t("common.error"), t("book.failed"));
      setBuilding(false);
    }
  };

  return (
    <LinearGradient colors={[colors.bgTop, colors.bgMid, colors.bgBottom]} style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.iconBtnText}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{t("book.pageTitle")}</Text>
          <View style={{ width: 40 }} />
        </View>

        {!isPremium ? (
          <UpgradePrompt
            title={t("book.premiumTitle")}
            description={t("book.premiumDesc")}
          />
        ) : (
          <>
            <View style={[styles.infoCard, shadows.soft]}>
              <Text style={styles.infoTitle}>{t("book.yourBook")}</Text>
              <Text style={styles.infoText}>
                {count === 0
                  ? t("book.noEntriesHint")
                  : t("book.countHint").replace("{count}", String(count))}
              </Text>
            </View>

            <Text style={styles.sectionLabel}>{t("book.coverLabel")}</Text>
            <View style={styles.coverRow}>
              {COVERS.map((c) => {
                const active = cover === c.id;
                return (
                  <Pressable
                    key={c.id}
                    style={[styles.coverCard, active && styles.coverCardActive]}
                    onPress={() => setCover(c.id)}
                  >
                    <LinearGradient colors={[c.from, c.to]} style={styles.coverSwatch}>
                      <Text style={styles.coverLetter}>📓</Text>
                    </LinearGradient>
                    <Text style={[styles.coverLabel, active && { color: colors.primary }]}>{t(c.labelKey)}</Text>
                  </Pressable>
                );
              })}
            </View>

            {building ? (
              <View style={styles.building}>
                <ActivityIndicator color={colors.primary} size="large" />
                <Text style={styles.buildingText}>{progress}</Text>
              </View>
            ) : (
              <Pressable
                style={[styles.buildBtn, shadows.soft, count === 0 && { opacity: 0.5 }]}
                onPress={buildBook}
                disabled={count === 0}
              >
                <Text style={styles.buildText}>{t("book.createPdf")}</Text>
              </Pressable>
            )}
          </>
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
  infoCard: { ...glassCard, padding: 18, marginBottom: 18 },
  infoTitle: { fontSize: 15, color: colors.text, fontFamily: appFonts.displayBold, marginBottom: 6 },
  infoText: { fontSize: 13, color: colors.textMuted, lineHeight: 19, fontFamily: appFonts.body },
  sectionLabel: { fontSize: 13, color: colors.textMuted, marginBottom: 10, fontFamily: appFonts.bodySemiBold },
  coverRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 },
  coverCard: { width: "47%", borderRadius: radius.card, padding: 10, backgroundColor: "rgba(255,255,255,0.5)", borderWidth: 2, borderColor: "transparent" },
  coverCardActive: { borderColor: colors.primary },
  coverSwatch: { height: 90, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  coverLetter: { fontSize: 30 },
  coverLabel: { fontSize: 13, color: colors.text, textAlign: "center", marginTop: 8, fontFamily: appFonts.bodySemiBold },
  building: { alignItems: "center", paddingVertical: 30 },
  buildingText: { fontSize: 14, color: colors.textMuted, marginTop: 12, fontFamily: appFonts.body },
  buildBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.input,
    paddingVertical: 16,
    alignItems: "center",
  },
  buildText: { color: colors.white, fontSize: 16, fontWeight: "700", fontFamily: appFonts.bodyBold },
});
