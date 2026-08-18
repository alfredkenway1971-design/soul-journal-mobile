import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput, Alert } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { colors, radius, fonts, glassCard, shadows } from "@/theme";
import { usePinStore } from "@/store/pinStore";

export default function PinSettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { hasPin, setPin, removePin, verifyPin } = usePinStore();
  const [mode, setMode] = useState<"create" | "remove">("create");
  const [pin, setPinInput] = useState("");
  const [confirm, setConfirm] = useState("");

  const submitCreate = async () => {
    if (pin.length < 4) {
      Alert.alert("PIN", "Le code doit avoir au moins 4 chiffres.");
      return;
    }
    if (pin !== confirm) {
      Alert.alert("PIN", "Les codes ne correspondent pas.");
      return;
    }
    await setPin(pin);
    setPinInput("");
    setConfirm("");
    Alert.alert("✓", "Code PIN activé.");
    navigation.goBack();
  };

  const submitRemove = async () => {
    if (!verifyPin(pin)) {
      Alert.alert("PIN", "Code incorrect.");
      return;
    }
    await removePin();
    setPinInput("");
    Alert.alert("✓", "Code PIN désactivé.");
    navigation.goBack();
  };

  return (
    <LinearGradient colors={[colors.bgTop, colors.bgMid, colors.bgBottom]} style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <Pressable style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.iconBtnText}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>🔐 Code PIN</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={[styles.card, shadows.card]}>
          <Text style={styles.title}>
            {hasPin ? "Protection active" : "Protégez votre journal"}
          </Text>
          <Text style={styles.desc}>
            {hasPin
              ? "Un code est demandé à l'ouverture de l'application."
              : "Ajoutez un code PIN pour verrouiller vos entrées."}
          </Text>

          {hasPin && (
            <View style={styles.modeRow}>
              <Pressable style={[styles.modeBtn, mode === "create" && styles.modeBtnActive]} onPress={() => setMode("create")}>
                <Text style={[styles.modeText, mode === "create" && { color: colors.white }]}>Changer</Text>
              </Pressable>
              <Pressable style={[styles.modeBtn, mode === "remove" && styles.modeBtnActive]} onPress={() => setMode("remove")}>
                <Text style={[styles.modeText, mode === "remove" && { color: colors.white }]}>Désactiver</Text>
              </Pressable>
            </View>
          )}

          <TextInput
            style={[styles.input, shadows.soft]}
            placeholder={mode === "remove" ? "Code actuel" : "Nouveau code (4+ chiffres)"}
            placeholderTextColor={colors.textFaint}
            keyboardType="number-pad"
            secureTextEntry
            value={pin}
            onChangeText={setPinInput}
            maxLength={8}
          />
          {mode === "create" && (
            <TextInput
              style={[styles.input, shadows.soft]}
              placeholder="Confirmer le code"
              placeholderTextColor={colors.textFaint}
              keyboardType="number-pad"
              secureTextEntry
              value={confirm}
              onChangeText={setConfirm}
              maxLength={8}
            />
          )}

          <Pressable
            style={[styles.btn, shadows.soft]}
            onPress={mode === "remove" ? submitRemove : submitCreate}
          >
            <Text style={styles.btnText}>{mode === "remove" ? "Désactiver le PIN" : "Activer le PIN"}</Text>
          </Pressable>
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
  card: { ...glassCard, padding: 20 },
  title: { fontSize: 17, color: colors.text, fontFamily: fonts.displayBold },
  desc: { fontSize: 13, color: colors.textMuted, marginTop: 6, lineHeight: 19, fontFamily: fonts.body },
  modeRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  modeBtn: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  modeBtnActive: { backgroundColor: colors.primary },
  modeText: { fontSize: 13, color: colors.primary, fontFamily: fonts.bodySemiBold },
  input: {
    backgroundColor: colors.white,
    borderRadius: radius.input,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    fontFamily: fonts.body,
    marginTop: 14,
    textAlign: "center",
    letterSpacing: 6,
  },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.input,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 16,
  },
  btnText: { color: colors.white, fontSize: 15, fontWeight: "700", fontFamily: fonts.bodyBold },
});
