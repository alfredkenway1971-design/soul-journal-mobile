import { useState, useMemo } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { colors, radius, glassCard, shadows } from "@/theme";
import { useAppFonts, type AppFonts } from "@/hooks/useAppFonts";
import { useFontStore, FONT_OPTIONS, fontFamilies } from "@/store/fontStore";
import { useT } from "@/store/settingsStore";

export default function FontsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const t = useT();
  const font = useFontStore((s) => s.font);
  const fontSize = useFontStore((s) => s.fontSize);
  const setFont = useFontStore((s) => s.setFont);
  const setFontSize = useFontStore((s) => s.setFontSize);
  const appFonts = useAppFonts();
  const styles = useMemo(() => makeStyles(appFonts), [appFonts]);
  const [preview, setPreview] = useState(() => t("fonts.elegant"));

  const previewFamilies = fontFamilies(font);
  const previewDisplay = previewFamilies.display;
  const previewBody = previewFamilies.body;

  const SIZES = [14, 16, 18, 20, 22];

  return (
    <LinearGradient colors={[colors.bgTop, colors.bgMid, colors.bgBottom]} style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.iconBtnText}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{t("fonts.title")}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Live preview */}
        <View style={[styles.previewCard, shadows.card]}>
          <Text style={[styles.previewTitle, { fontFamily: previewDisplay, fontSize }]}>
            {preview}
          </Text>
          <Text style={[styles.previewBody, { fontFamily: previewBody, fontSize: Math.max(12, fontSize - 2) }]}>
            {t("fonts.previewBody")}
          </Text>
          <Text style={styles.previewHint}>{t("fonts.applies")}</Text>
        </View>

        {/* Font size */}
        <Text style={styles.sectionLabel}>{t("fonts.sizeLabel")}</Text>
        <View style={[styles.sizeRow, shadows.soft]}>
          {SIZES.map((s) => {
            const active = fontSize === s;
            return (
              <Pressable
                key={s}
                style={[styles.sizeChip, active && styles.sizeChipActive]}
                onPress={() => setFontSize(s)}
              >
                <Text style={[styles.sizeText, active && { color: colors.white, fontWeight: "700" }]}>{s}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* All 16 fonts */}
        <Text style={styles.sectionLabel}>{t("fonts.fontLabel")}</Text>
        <View style={[styles.card, shadows.card]}>
          {FONT_OPTIONS.map((f) => {
            const active = font === f.id;
            const fam = fontFamilies(f.id);
            return (
              <Pressable
                key={f.id}
                style={[styles.optionRow, active && styles.optionRowActive]}
                onPress={() => setFont(f.id)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionSample, { fontFamily: fam.display, fontSize: 18 }]}>
                    {f.name}
                  </Text>
                  <Text style={[styles.optionMeta, { fontFamily: fam.body }]}>
                    {f.family}
                  </Text>
                </View>
                {active && <Text style={styles.check}>✓</Text>}
              </Pressable>
            );
          })}
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
    width: 40, height: 40, borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.7)", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(148,163,184,0.4)",
  },
  iconBtnText: { fontSize: 20, color: colors.primary, fontFamily: appFonts.bodyBold },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 18, color: colors.text, fontFamily: appFonts.displayBold },
  previewCard: {
    ...glassCard,
    padding: 24,
    alignItems: "center",
    marginBottom: 18,
  },
  previewTitle: { color: colors.text, textAlign: "center", marginBottom: 10 },
  previewBody: { color: colors.textMuted, textAlign: "center", fontFamily: appFonts.body },
  previewHint: { fontSize: 11, color: colors.textFaint, marginTop: 12, fontFamily: appFonts.body },
  sectionLabel: { fontSize: 13, color: colors.textMuted, marginBottom: 10, fontFamily: appFonts.bodySemiBold },
  sizeRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: radius.input,
    padding: 6,
    marginBottom: 18,
  },
  sizeChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.input,
    alignItems: "center",
  },
  sizeChipActive: { backgroundColor: colors.primary },
  sizeText: { fontSize: 14, color: colors.textMuted, fontFamily: appFonts.body },
  card: { ...glassCard, padding: 8, marginBottom: 16 },
  optionRow: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: radius.input },
  optionRowActive: { backgroundColor: "rgba(29,129,237,0.10)" },
  optionSample: { color: colors.text },
  optionMeta: { fontSize: 11, color: colors.textFaint, marginTop: 2 },
  check: { fontSize: 18, color: colors.primary, fontWeight: "700" },
});
