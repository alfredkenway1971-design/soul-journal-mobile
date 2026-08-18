import { useState, useMemo } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { colors, radius, fonts, glassCard, shadows } from "@/theme";
import { useAppFonts, type AppFonts } from "@/hooks/useAppFonts";
import { supabase } from "@/lib/supabase";
import { useT } from "@/store/settingsStore";
import { usePinStore } from "@/store/pinStore";

export default function SecurityScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const appFonts = useAppFonts();
  const styles = useMemo(() => makeStyles(appFonts), [appFonts]);
  const t = useT();
  const hasPin = usePinStore((s) => s.hasPin);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const changePassword = async () => {
    if (next.length < 6) {
      Alert.alert(t("security.password"), t("security.pwTooShort"));
      return;
    }
    if (next !== confirm) {
      Alert.alert(t("security.password"), t("security.pwMismatch"));
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw error;
      Alert.alert(t("common.ok"), t("security.pwUpdated"));
      setCurrent("");
      setNext("");
      setConfirm("");
      navigation.goBack();
    } catch (e: any) {
      console.warn("password error", e);
      Alert.alert(t("common.error"), e?.message ?? t("security.pwChangeFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <LinearGradient colors={[colors.bgTop, colors.bgMid, colors.bgBottom]} style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <Pressable style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.iconBtnText}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{t("security.title")}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* PIN status */}
        <View style={[styles.card, shadows.card]}>
          <View style={styles.rowTop}>
            <Text style={styles.rowEmoji}>🔐</Text>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.rowTitle}>{t("security.pinStatus")}</Text>
              <Text style={styles.rowDesc}>
                {hasPin ? t("security.pinActive") : t("security.notConfigured")}
              </Text>
            </View>
          </View>
          <Pressable style={styles.linkBtn} onPress={() => navigation.navigate("PinSettings")}>
            <Text style={styles.linkText}>{hasPin ? t("security.managePin") : t("security.setPin")}</Text>
          </Pressable>
        </View>

        {/* Change password */}
        <View style={[styles.card, shadows.card]}>
          <Text style={styles.cardTitle}>{t("security.changePwTitle")}</Text>

          <Text style={styles.label}>{t("security.currentPw")}</Text>
          <TextInput
            style={[styles.input, shadows.soft]}
            secureTextEntry
            value={current}
            onChangeText={setCurrent}
            placeholder="••••••••"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
          />

          <Text style={styles.label}>{t("security.newPw")}</Text>
          <TextInput
            style={[styles.input, shadows.soft]}
            secureTextEntry
            value={next}
            onChangeText={setNext}
            placeholder={t("security.minChars")}
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
          />

          <Text style={styles.label}>{t("security.confirmPw")}</Text>
          <TextInput
            style={[styles.input, shadows.soft]}
            secureTextEntry
            value={confirm}
            onChangeText={setConfirm}
            placeholder="••••••••"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
          />

          <Pressable style={[styles.saveBtn, shadows.soft, busy && { opacity: 0.6 }]} onPress={changePassword} disabled={busy}>
            {busy ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.saveBtnText}>{t("security.changePassword")}</Text>
            )}
          </Pressable>
        </View>

        <Text style={styles.footnote}>
          {t("security.staysActive")}
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
    width: 40, height: 40, borderRadius: 999,
    backgroundColor: colors.cardGlassStrong, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.glassBorder,
  },
  iconBtnText: { fontSize: 20, color: colors.primary, fontFamily: appFonts.bodyBold },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 18, color: colors.text, fontFamily: appFonts.displayBold },
  card: { ...glassCard, padding: 18, marginBottom: 14 },
  rowTop: { flexDirection: "row", alignItems: "center" },
  rowEmoji: { fontSize: 26 },
  rowTitle: { fontSize: 15, color: colors.text, fontFamily: appFonts.bodySemiBold },
  rowDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2, fontFamily: appFonts.body },
  linkBtn: { marginTop: 12 },
  linkText: { fontSize: 13, color: colors.primary, fontFamily: appFonts.bodySemiBold },
  cardTitle: { fontSize: 15, color: colors.text, fontFamily: appFonts.displayBold, marginBottom: 14 },
  label: { fontSize: 12, color: colors.textMuted, fontFamily: appFonts.bodySemiBold, marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: colors.white,
    borderRadius: radius.input,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    fontFamily: appFonts.body,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.input,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 16,
  },
  saveBtnText: { color: colors.white, fontSize: 15, fontWeight: "700", fontFamily: appFonts.bodyBold },
  footnote: { fontSize: 11, color: colors.textFaint, textAlign: "center", marginTop: 8, lineHeight: 16, fontFamily: appFonts.body },
});
