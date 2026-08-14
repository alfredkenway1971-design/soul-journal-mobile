import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, radius } from "@/theme";
import { useAuthStore } from "@/store/authStore";

export default function AuthScreen() {
  const { signIn, signUp } = useAuthStore();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim() || password.length < 6) {
      Alert.alert("Soul Journal", "Veuillez entrer un email valide et un mot de passe (6+ caractères).");
      return;
    }
    setBusy(true);
    const { error } = isLogin ? await signIn(email.trim(), password) : await signUp(email.trim(), password);
    setBusy(false);
    if (error) Alert.alert(isLogin ? "Connexion impossible" : "Inscription", error);
  };

  return (
    <LinearGradient colors={[colors.bgTop, colors.bgBottom]} style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.logo}>✨ Soul Journal</Text>
          <Text style={styles.tagline}>
            Votre journal guidé par l'IA — parlez, écrivez, et découvrez qui vous êtes.
          </Text>

          <View style={styles.card}>
            <Text style={styles.title}>{isLogin ? "Connexion" : "Créer un compte"}</Text>

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={styles.input}
              placeholder="Mot de passe"
              placeholderTextColor={colors.textFaint}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <Pressable
              style={[styles.button, busy && { opacity: 0.6 }]}
              onPress={submit}
              disabled={busy}
            >
              <Text style={styles.buttonText}>{busy ? "..." : isLogin ? "Se connecter" : "Créer mon compte"}</Text>
            </Pressable>

            <Pressable onPress={() => setIsLogin((v) => !v)} style={{ marginTop: 16 }}>
              <Text style={styles.switchText}>
                {isLogin ? "Pas de compte ? Inscrivez-vous" : "Déjà un compte ? Connectez-vous"}
              </Text>
            </Pressable>
          </View>

          <Text style={styles.footnote}>
            Google Sign-In arrive dans la prochaine étape (Phase 1.1).
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flexGrow: 1, justifyContent: "center", padding: 24 },
  logo: { fontSize: 34, fontWeight: "700", color: colors.primary, textAlign: "center" },
  tagline: { fontSize: 15, color: colors.textMuted, textAlign: "center", marginTop: 8, marginBottom: 32, lineHeight: 22 },
  card: {
    backgroundColor: colors.cardGlass,
    borderRadius: radius.card,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
  },
  title: { fontSize: 20, fontWeight: "600", color: colors.text, marginBottom: 16 },
  input: {
    backgroundColor: colors.white,
    borderRadius: radius.input,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.input,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
  },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: "700" },
  switchText: { color: colors.primary, textAlign: "center", fontSize: 14, fontWeight: "600" },
  footnote: { color: colors.textFaint, textAlign: "center", marginTop: 24, fontSize: 12 },
});
