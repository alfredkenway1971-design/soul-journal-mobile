import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { colors, radius, fonts, glassCard, shadows } from "@/theme";
import { useT } from "@/store/settingsStore";
import { useThemeStore, THEME_OPTIONS } from "@/store/themeStore";

export default function ThemesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const t = useT();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <LinearGradient
      colors={THEME_OPTIONS.find((o) => o.key === theme)?.gradient ?? [colors.bgTop, colors.bgMid, colors.bgBottom]}
      style={styles.root}
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.iconBtnText}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>🎨 Thèmes</Text>
          <View style={{ width: 40 }} />
        </View>

        <Text style={styles.sectionLabel}>Choisissez votre ambiance (clair uniquement)</Text>

        <View style={[styles.card, shadows.card]}>
          {THEME_OPTIONS.map((o) => {
            const active = theme === o.key;
            return (
              <Pressable
                key={o.key}
                style={[styles.optionRow, active && styles.optionRowActive]}
                onPress={() => setTheme(o.key)}
              >
                <View style={[styles.swatch, { backgroundColor: o.swatch }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionLabel}>{o.label}</Text>
                  <Text style={styles.optionSub}>{o.desc}</Text>
                </View>
                {active && <Text style={styles.check}>✓</Text>}
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.footnote}>
          Le thème est enregistré sur cet appareil.
        </Text>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 999,
    backgroundColor: colors.cardGlassStrong, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.glassBorder,
  },
  iconBtnText: { fontSize: 20, color: colors.primary, fontFamily: fonts.bodyBold },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 18, color: colors.text, fontFamily: fonts.displayBold },
  sectionLabel: { fontSize: 13, color: colors.textMuted, marginBottom: 10, fontFamily: fonts.bodySemiBold },
  card: { ...glassCard, padding: 8, marginBottom: 16 },
  optionRow: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: radius.input },
  optionRowActive: { backgroundColor: "rgba(255,255,255,0.7)" },
  swatch: { width: 36, height: 36, borderRadius: 10, marginRight: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.6)" },
  optionLabel: { fontSize: 15, color: colors.text, fontFamily: fonts.bodySemiBold },
  optionSub: { fontSize: 12, color: colors.textMuted, marginTop: 2, fontFamily: fonts.body },
  check: { fontSize: 18, color: colors.primary, fontWeight: "700" },
  footnote: { fontSize: 11, color: colors.textFaint, textAlign: "center", fontFamily: fonts.body },
});
