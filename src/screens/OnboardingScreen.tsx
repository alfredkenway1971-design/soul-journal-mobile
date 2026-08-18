import { useRef, useState } from "react";
import {
  View, Text, Pressable, StyleSheet, ScrollView, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, radius, fonts, glassCard, shadows } from "@/theme";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { useSettingsStore } from "@/store/settingsStore";
import { LANGUAGES } from "@/i18n/translations";

const QUESTIONS = [
  { id: "identity", title: "Parlez-moi de vous", subtitle: "Qu'est-ce qui vous amène ici ? Partagez un peu qui vous êtes." },
  { id: "growth", title: "Que voulez-vous améliorer ?", subtitle: "Quels changements ou croissance cherchez-vous ?" },
  { id: "pride", title: "De quoi êtes-vous fier ?", subtitle: "Parlez-moi de quelque chose qui vous rend fier." },
  { id: "blockers", title: "Qu'est-ce qui vous retient ?", subtitle: "Quels schémas ou obstacles se mettent en travers ?" },
  { id: "fears", title: "Qu'est-ce qui vous fait peur ?", subtitle: "De quoi craignez-vous de perdre, d'échouer ou de devenir ?" },
  { id: "alive", title: "Quand vous sentez-vous vivant ?", subtitle: "Quels moments ou activités vous motivent vraiment ?" },
];

const WORLDVIEWS = [
  { label: "Spirituel", emoji: "✨", value: "Spiritual" },
  { label: "Sans préférence", emoji: "🌍", value: "No preference" },
  { label: "Chrétien", emoji: "✝️", value: "Christianity" },
  { label: "Islam", emoji: "☪️", value: "Islam" },
  { label: "Bouddhisme", emoji: "☸️", value: "Buddhism" },
  { label: "Hindouisme", emoji: "🕉️", value: "Hinduism" },
];

interface SoulProfile {
  personality_type?: string;
  summary?: string;
  strengths?: string[];
}

export default function OnboardingScreen() {
  const user = useAuthStore((s) => s.user);
  const setLanguage = useSettingsStore((s) => s.setLanguage);

  const [step, setStep] = useState(0); // 0=lang, 1-6=questions, 7=worldview, 8=analyzing, 9=results
  const [answers, setAnswers] = useState<string[]>(Array(6).fill(""));
  const [worldview, setWorldview] = useState<string | null>(null);
  const [profile, setProfile] = useState<SoulProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const canProceed = step === 0 ? true : step >= 1 && step <= 6 ? (answers[step - 1] || "").trim().length > 0 : true;

  const analyze = async () => {
    if (!user) return;
    setBusy(true);
    setStep(8);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-soul-profile", {
        body: { answers, worldview, language: "fr" },
      });
      if (error) throw error;
      if (!data?.profile) throw new Error("no profile");
      setProfile(data.profile);

      // Persist: onboarding_completed + soul_profile_summary
      await supabase.from("profiles").update({
        onboarding_completed: true,
        worldview,
        soul_profile_summary: data.profile,
      }).eq("id", user.id);

      setStep(9);
    } catch (e) {
      console.warn("analyze error", e);
      Alert.alert("Erreur", "L'analyse a échoué. Réessayez.");
      setStep(7);
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    if (!canProceed || busy) return;
    if (step === 7) { analyze(); return; }
    setStep((s) => s + 1);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const finish = async () => {
    // Mark done and let the app proceed (RootNavigator shows tabs when onboarding_completed)
    await supabase.from("profiles").update({ onboarding_completed: true }).eq("id", user!.id);
    // Trigger a refresh of the auth-driven UI
    useAuthStore.setState((s) => ({ ...s }));
    Alert.alert("✨ Bienvenue !", "Votre profil est prêt. Bonne écriture !");
  };

  const isLastStep = step === 9;

  return (
    <LinearGradient colors={[colors.bgTop, colors.bgMid, colors.bgBottom]} style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Progress */}
          <View style={styles.progressWrap}>
            {Array.from({ length: 9 }).map((_, i) => (
              <View key={i} style={[styles.progressDot, i <= step && styles.progressDotActive]} />
            ))}
          </View>

          {step === 0 && (
            <>
              <Text style={styles.title}>🌍 Choisissez votre langue</Text>
              <Text style={styles.subtitle}>Votre journal s'affichera dans cette langue.</Text>
              <View style={[styles.card, shadows.card]}>
                {LANGUAGES.map((l) => (
                  <Pressable key={l.code} style={styles.langRow} onPress={async () => { await setLanguage(l.code); }}>
                    <Text style={styles.langFlag}>{l.flag}</Text>
                    <Text style={styles.langName}>{l.native}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {step >= 1 && step <= 6 && (
            <>
              <Text style={styles.stepBadge}>Question {step}/6</Text>
              <Text style={styles.title}>{QUESTIONS[step - 1].title}</Text>
              <Text style={styles.subtitle}>{QUESTIONS[step - 1].subtitle}</Text>
              <TextInput
                style={[styles.input, shadows.soft]}
                placeholder="Écrivez votre réponse…"
                placeholderTextColor={colors.textFaint}
                multiline
                value={answers[step - 1]}
                onChangeText={(v) => setAnswers((a) => a.map((x, i) => (i === step - 1 ? v : x)))}
                textAlignVertical="top"
              />
            </>
          )}

          {step === 7 && (
            <>
              <Text style={styles.title}>🌍 Croyances & vision du monde</Text>
              <Text style={styles.subtitle}>Optionnel — aide l'IA à adapter ses conseils.</Text>
              <View style={[styles.card, shadows.card]}>
                {WORLDVIEWS.map((w) => {
                  const active = worldview === w.value;
                  return (
                    <Pressable
                      key={w.value}
                      style={[styles.wvRow, active && styles.wvRowActive]}
                      onPress={() => setWorldview(w.value)}
                    >
                      <Text style={styles.wvEmoji}>{w.emoji}</Text>
                      <Text style={[styles.wvLabel, active && { color: colors.primary, fontWeight: "700" }]}>{w.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {step === 8 && (
            <View style={styles.analyzing}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={styles.analyzingText}>Analyse de votre profil…</Text>
              <Text style={styles.analyzingSub}>L'IA lit vos réponses pour créer votre portrait.</Text>
            </View>
          )}

          {step === 9 && profile && (
            <>
              <Text style={styles.title}>🪞 Votre profil</Text>
              {profile.personality_type && (
                <View style={[styles.card, shadows.card]}>
                  <Text style={styles.cardLabel}>Type de personnalité</Text>
                  <Text style={styles.cardText}>{profile.personality_type}</Text>
                </View>
              )}
              {profile.summary && (
                <View style={[styles.card, shadows.card]}>
                  <Text style={styles.cardLabel}>Résumé</Text>
                  <Text style={styles.cardText}>{profile.summary}</Text>
                </View>
              )}
              {profile.strengths && profile.strengths.length > 0 && (
                <View style={[styles.card, shadows.card]}>
                  <Text style={styles.cardLabel}>Vos forces</Text>
                  {profile.strengths.map((s, i) => (
                    <Text key={i} style={styles.strength}>• {s}</Text>
                  ))}
                </View>
              )}
            </>
          )}

          {/* Footer */}
          {!isLastStep && (
            <Pressable style={[styles.nextBtn, shadows.soft, (!canProceed || busy) && { opacity: 0.5 }]} onPress={next} disabled={!canProceed || busy}>
              <Text style={styles.nextText}>{step === 7 ? "✨ Analyser mon profil" : "Continuer"}</Text>
            </Pressable>
          )}
          {isLastStep && (
            <Pressable style={[styles.nextBtn, shadows.soft]} onPress={finish}>
              <Text style={styles.nextText}>Commencer ✨</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 24, paddingBottom: 60 },
  progressWrap: { flexDirection: "row", justifyContent: "center", gap: 6, marginBottom: 24 },
  progressDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: colors.glassBorder },
  progressDotActive: { backgroundColor: colors.primary },
  title: { fontSize: 22, color: colors.text, fontFamily: fonts.displayBold, marginBottom: 6 },
  subtitle: { fontSize: 14, color: colors.textMuted, marginBottom: 20, lineHeight: 20, fontFamily: fonts.body },
  stepBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.primaryLight,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 4,
    fontSize: 12,
    color: colors.primary,
    fontFamily: fonts.bodySemiBold,
    marginBottom: 10,
    overflow: "hidden",
  },
  card: { ...glassCard, padding: 16, marginBottom: 16 },
  langRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.glassBorder },
  langFlag: { fontSize: 20, marginRight: 12 },
  langName: { fontSize: 15, color: colors.text, fontFamily: fonts.bodyMedium },
  input: {
    backgroundColor: colors.white,
    borderRadius: radius.input,
    padding: 16,
    minHeight: 140,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    fontFamily: fonts.body,
  },
  wvRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.glassBorder },
  wvRowActive: { backgroundColor: colors.primaryLight, borderRadius: radius.input, paddingHorizontal: 10 },
  wvEmoji: { fontSize: 20, marginRight: 12 },
  wvLabel: { fontSize: 15, color: colors.text, fontFamily: fonts.body },
  analyzing: { alignItems: "center", paddingVertical: 60 },
  analyzingText: { fontSize: 16, color: colors.text, fontFamily: fonts.bodySemiBold, marginTop: 16 },
  analyzingSub: { fontSize: 13, color: colors.textMuted, marginTop: 6, fontFamily: fonts.body },
  cardLabel: { fontSize: 12, color: colors.primary, fontFamily: fonts.bodySemiBold, marginBottom: 6, textTransform: "uppercase" },
  cardText: { fontSize: 14, lineHeight: 21, color: colors.text, fontFamily: fonts.body },
  strength: { fontSize: 14, color: colors.text, fontFamily: fonts.body, marginTop: 4 },
  nextBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.input,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  nextText: { color: colors.white, fontSize: 16, fontWeight: "700", fontFamily: fonts.bodyBold },
});
