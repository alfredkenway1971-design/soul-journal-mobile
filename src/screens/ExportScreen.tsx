import { useState, useMemo } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Alert, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { colors, radius, fonts, glassCard, shadows } from "@/theme";
import { useAppFonts, type AppFonts } from "@/hooks/useAppFonts";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { useT, useSettingsStore, localeFor } from "@/store/settingsStore";

const MOOD_EMOJI: Record<string, string> = {
  happy: "😊",
  good: "😇",
  fine: "😌",
  sad: "😔",
  unhappy: "😢",
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>");

const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString(localeFor(useSettingsStore.getState().language), { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
};

export default function ExportScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const appFonts = useAppFonts();
  const styles = useMemo(() => makeStyles(appFonts), [appFonts]);
  const user = useAuthStore((s) => s.user);
  const t = useT();
  const [exporting, setExporting] = useState(false);

  const exportPdf = async () => {
    if (!user) return;
    setExporting(true);
    try {
      const { data: entries } = await supabase
        .from("journal_entries")
        .select("title, enhanced_text, original_transcription, mood, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200);

      const count = entries?.length ?? 0;
      const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: Georgia, serif; color: #192434; padding: 24px; }
  h1 { color: #1d81ed; font-size: 26px; margin-bottom: 4px; }
  .sub { color: #52637a; font-size: 13px; margin-bottom: 28px; }
  .entry { border-bottom: 1px solid #c9dbe8; padding: 18px 0; page-break-inside: avoid; }
  .date { color: #8ba0b8; font-size: 12px; margin-bottom: 4px; }
  .title { font-size: 18px; font-weight: bold; margin-bottom: 8px; }
  .body { font-size: 14px; line-height: 1.6; color: #333; }
  .mood { font-size: 14px; margin-top: 6px; }
  .empty { color: #52637a; font-style: italic; }
</style>
</head>
<body>
  <h1>${t("export.h1")}</h1>
  <div class="sub">${count} ${count > 1 ? t("export.entryMany") : t("export.entryOne")} · ${t("export.exportedOn")} ${new Date().toLocaleDateString(localeFor(useSettingsStore.getState().language))}</div>
  ${count === 0 ? `<p class="empty">${t("export.empty")}</p>` : (entries ?? []).map((e) => `
  <div class="entry">
    <div class="date">${fmtDate(e.created_at)}</div>
    <div class="title">${escapeHtml(e.title || t("entry.untitled"))}</div>
    <div class="body">${escapeHtml((e.enhanced_text || e.original_transcription || ""))}</div>
    <div class="mood">${MOOD_EMOJI[e.mood ?? ""] ?? ""}</div>
  </div>`).join("")}
</body>
</html>`;

      const { uri } = await Print.printToFileAsync({ html });
      if (!uri) throw new Error("no pdf");

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: t("export.dialogTitle") });
      } else {
        Alert.alert(t("export.created"), t("export.createdBody").replace("{uri}", uri));
      }
    } catch (e) {
      console.warn("export error", e);
      Alert.alert(t("common.error"), t("export.failed"));
    } finally {
      setExporting(false);
    }
  };

  return (
    <LinearGradient colors={[colors.bgTop, colors.bgMid, colors.bgBottom]} style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color={colors.primary} />
          </Pressable>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={styles.headerTitle}>{t("export.title")}</Text>
            <Text style={styles.headerSub}>{t("export.download")}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Hero (web ExportPage parity) */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="download-outline" size={34} color={colors.primary} />
          </View>
          <Text style={styles.heroTitle}>{t("export.exportYourEntries")}</Text>
          <Text style={styles.heroDesc}>{t("export.exportDescription")}</Text>
        </View>

        {/* Soul Book Builder (PDF) — the web's main export card */}
        <Pressable
          style={[styles.soulCard, shadows.soft]}
          onPress={() => navigation.navigate("BookBuilder")}
        >
          <View style={styles.soulIcon}>
            <Ionicons name="book-outline" size={26} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.soulTitle}>{t("export.soulBook")}</Text>
            <Text style={styles.soulDesc}>{t("export.soulBookDesc")}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
        </Pressable>

        {/* Quick PDF (existing export preserved) */}
        <View style={[styles.quickCard, shadows.soft]}>
          <View style={styles.quickIcon}>
            <Ionicons name="document-text-outline" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.quickTitle}>{t("export.createPdf")}</Text>
            <Text style={styles.quickDesc}>{t("export.desc")}</Text>
          </View>
          <Pressable
            style={[styles.quickBtn, exporting && { opacity: 0.6 }]}
            onPress={exportPdf}
            disabled={exporting}
          >
            {exporting ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.quickBtnText}>PDF</Text>
            )}
          </Pressable>
        </View>

        <Text style={styles.footnote}>
          {t("export.exportInfo")}
        </Text>
      </ScrollView>
    </LinearGradient>
  );
}

const makeStyles = (appFonts: AppFonts) => StyleSheet.create({
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
  headerTitle: { fontSize: 18, color: colors.text, fontFamily: appFonts.displayBold },
  headerSub: { fontSize: 12, color: colors.textMuted, marginTop: 1, fontFamily: appFonts.body },
  hero: { alignItems: "center", paddingVertical: 14 },
  heroIcon: {
    width: 80,
    height: 80,
    borderRadius: 26,
    backgroundColor: "rgba(29,129,237,0.10)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  heroTitle: { fontSize: 19, color: colors.text, fontFamily: appFonts.displayBold },
  heroDesc: { fontSize: 13, color: colors.textMuted, textAlign: "center", marginTop: 6, lineHeight: 19, fontFamily: appFonts.body, paddingHorizontal: 10 },
  soulCard: {
    ...glassCard,
    borderRadius: radius.card,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 18,
  },
  soulIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "rgba(29,129,237,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  soulTitle: { fontSize: 15, color: colors.text, fontFamily: appFonts.bodySemiBold },
  soulDesc: { fontSize: 12, color: colors.textMuted, marginTop: 3, fontFamily: appFonts.body, lineHeight: 16 },
  quickCard: {
    ...glassCard,
    borderRadius: radius.card,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
  },
  quickIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(29,129,237,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  quickTitle: { fontSize: 14, color: colors.text, fontFamily: appFonts.bodySemiBold },
  quickDesc: { fontSize: 11.5, color: colors.textMuted, marginTop: 2, fontFamily: appFonts.body, lineHeight: 15 },
  quickBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.input,
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  quickBtnText: { color: colors.white, fontSize: 12, fontWeight: "700", fontFamily: appFonts.bodyBold },
  footnote: { fontSize: 11.5, color: colors.textFaint, textAlign: "center", marginTop: 22, fontFamily: appFonts.body, lineHeight: 16 },
});
