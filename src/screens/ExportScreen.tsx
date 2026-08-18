import { useState, useMemo } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Alert, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import { useNavigation } from "@react-navigation/native";
import { colors, radius, fonts, glassCard, shadows } from "@/theme";
import { useAppFonts, type AppFonts } from "@/hooks/useAppFonts";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { useT } from "@/store/settingsStore";

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
    return new Date(iso).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
};

export default function ExportScreen() {
  const navigation = useNavigation();
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
  <h1>📖 Mon journal — Soul Journal</h1>
  <div class="sub">${count} entrée${count > 1 ? "s" : ""} · Exporté le ${new Date().toLocaleDateString("fr-CA")}</div>
  ${count === 0 ? '<p class="empty">Aucune entrée.</p>' : (entries ?? []).map((e) => `
  <div class="entry">
    <div class="date">${fmtDate(e.created_at)}</div>
    <div class="title">${escapeHtml(e.title || "Sans titre")}</div>
    <div class="body">${escapeHtml((e.enhanced_text || e.original_transcription || ""))}</div>
    <div class="mood">${MOOD_EMOJI[e.mood ?? ""] ?? ""}</div>
  </div>`).join("")}
</body>
</html>`;

      const { uri } = await Print.printToFileAsync({ html });
      if (!uri) throw new Error("no pdf");

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Mon journal" });
      } else {
        Alert.alert("PDF créé", `Fichier : ${uri}`);
      }
    } catch (e) {
      console.warn("export error", e);
      Alert.alert("Erreur", "Impossible de créer le PDF.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <LinearGradient colors={[colors.bgTop, colors.bgMid, colors.bgBottom]} style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.iconBtnText}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>📖 Exporter</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={[styles.card, shadows.card]}>
          <Text style={styles.cardEmoji}>📖</Text>
          <Text style={styles.cardTitle}>Mon journal en PDF</Text>
          <Text style={styles.cardDesc}>
            Exportez toutes vos entrées dans un beau document PDF, prêt à partager ou à conserver.
          </Text>
          <Pressable style={[styles.exportBtn, shadows.soft, exporting && { opacity: 0.6 }]} onPress={exportPdf} disabled={exporting}>
            {exporting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.exportBtnText}>📄 Créer le PDF</Text>
            )}
          </Pressable>
        </View>

        <Text style={styles.footnote}>
          Jusqu'à 200 entrées récentes. Le PDF s'ouvre dans la feuille de partage.
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
  iconBtnText: { fontSize: 20, color: colors.primary, fontFamily: appFonts.bodyBold },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 18, color: colors.text, fontFamily: appFonts.displayBold },
  card: {
    ...glassCard,
    padding: 24,
    alignItems: "center",
  },
  cardEmoji: { fontSize: 40, marginBottom: 10 },
  cardTitle: { fontSize: 17, color: colors.text, fontFamily: appFonts.displayBold, textAlign: "center" },
  cardDesc: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
    fontFamily: appFonts.body,
  },
  exportBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.input,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 18,
  },
  exportBtnText: { color: colors.white, fontSize: 15, fontWeight: "700", fontFamily: appFonts.bodyBold },
  footnote: { fontSize: 11, color: colors.textFaint, textAlign: "center", marginTop: 14, fontFamily: appFonts.body },
});
