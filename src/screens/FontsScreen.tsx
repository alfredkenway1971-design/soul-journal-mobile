import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { colors, radius, fonts, glassCard, shadows } from "@/theme";
import { useT } from "@/store/settingsStore";
import { useFontStore, FONT_OPTIONS } from "@/store/fontStore";
import { useAppFonts } from "@/hooks/useAppFonts";

export default function FontsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const t = useT();
  const display = useFontStore((s) => s.display);
  const setDisplay = useFontStore((s) => s.setDisplay);
  const appFonts = useAppFonts();

  return (
    <LinearGradient colors={[colors.bgTop, colors.bgMid, colors.bgBottom]} style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.iconBtnText}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>🔤 Police d'écriture</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={[styles.previewCard, shadows.card]}>
          <Text style={[styles.previewTitle, { fontFamily: appFonts.displayBold }]}>
            {display === "caveat" ? "Une écriture élégante" : display === "inter" ? "Un style moderne" : "Une écriture élégante"}
          </Text>
          <Text style={styles.previewBody}>
            Les titres changent instantanément — le corps du texte reste lisible.
          </Text>
        </View>

        <View style={[styles.card, shadows.card]}>
          {FONT_OPTIONS.map((f) => {
            const active = display === f.key;
            return (
              <Pressable
                key={f.key}
                style={[styles.optionRow, active && styles.optionRowActive]}
                onPress={() => setDisplay(f.key)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionLabel, { fontFamily: f.key === "caveat" ? "Caveat_700Bold" : f.key === "inter" ? "Inter_700Bold" : "PlayfairDisplay_700Bold" }]}>
                    {f.label}
                  </Text>
                  <Text style={styles.optionSub}>{f.native}</Text>
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
  previewCard: { ...glassCard, padding: 22, alignItems: "center", marginBottom: 16 },
  previewTitle: { fontSize: 24, color: colors.text, textAlign: "center", marginBottom: 8 },
  previewBody: { fontSize: 13, color: colors.textMuted, textAlign: "center", lineHeight: 19, fontFamily: fonts.body },
  card: { ...glassCard, padding: 8, marginBottom: 16 },
  optionRow: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: radius.input },
  optionRowActive: { backgroundColor: colors.primaryLight },
  optionLabel: { fontSize: 17, color: colors.text },
  optionSub: { fontSize: 12, color: colors.textMuted, marginTop: 2, fontFamily: fonts.body },
  check: { fontSize: 18, color: colors.primary, fontWeight: "700" },
});
