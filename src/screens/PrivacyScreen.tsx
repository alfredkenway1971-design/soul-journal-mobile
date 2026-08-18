import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { useMemo } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { colors, radius, glassCard, shadows } from "@/theme";
import { useAppFonts, type AppFonts } from "@/hooks/useAppFonts";
import { useT } from "@/store/settingsStore";

export default function PrivacyScreen() {
  const navigation = useNavigation();
  const appFonts = useAppFonts();
  const styles = useMemo(() => makeStyles(appFonts), [appFonts]);
  const t = useT();

  return (
    <LinearGradient colors={[colors.bgTop, colors.bgMid, colors.bgBottom]} style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.iconBtnText}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>🔒 {t("privacy.title")}</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={[styles.card, shadows.card]}>
          <Text style={styles.h1}>{t("privacy.pageTitle")}</Text>
          <Text style={styles.updated}>{t("privacy.lastUpdated")}</Text>

          <Text style={styles.h2}>{t("privacy.section1")}</Text>
          <Text style={styles.p}>{t("privacy.account")}</Text>
          <Text style={styles.p}>{t("privacy.entries")}</Text>
          <Text style={styles.p}>{t("privacy.voice")}</Text>

          <Text style={styles.h2}>{t("privacy.section2")}</Text>
          <Text style={styles.p}>{t("privacy.aiSent")}</Text>

          <Text style={styles.h2}>{t("privacy.section3")}</Text>
          <Text style={styles.p}>{t("privacy.diagnostics")}</Text>
          <Text style={styles.p}>{t("privacy.payments")}</Text>

          <Text style={styles.h2}>{t("privacy.s4Title")}</Text>
          <Text style={styles.p}>{t("privacy.s4Body")}</Text>

          <Text style={styles.h2}>{t("privacy.s5Title")}</Text>
          <Text style={styles.p}>{t("privacy.s5Body")} amer.niyonzima@gmail.com</Text>

          <Text style={styles.h2}>{t("privacy.s6Title")}</Text>
          <Text style={styles.p}>amer.niyonzima@gmail.com</Text>
        </View>
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
    padding: 20,
  },
  h1: { fontSize: 17, color: colors.text, fontFamily: appFonts.displayBold, marginBottom: 4 },
  updated: { fontSize: 12, color: colors.textFaint, fontFamily: appFonts.body, marginBottom: 14 },
  h2: { fontSize: 14, color: colors.primary, fontFamily: appFonts.bodySemiBold, marginTop: 14, marginBottom: 6 },
  p: { fontSize: 13, lineHeight: 20, color: colors.text, fontFamily: appFonts.body, marginBottom: 4 },
  b: { fontWeight: "700" },
});
