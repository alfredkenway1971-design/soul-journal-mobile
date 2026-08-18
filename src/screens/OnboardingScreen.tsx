import { useRef, useState, useMemo } from "react";
import {
  View, Text, Pressable, StyleSheet, ScrollView, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, radius, fonts, glassCard, shadows } from "@/theme";
import { useAppFonts, type AppFonts } from "@/hooks/useAppFonts";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { useSettingsStore, useT } from "@/store/settingsStore";
import { LANGUAGES } from "@/i18n/translations";

const QUESTIONS = [
  { id: "identity", titleKey: "onb.qIdentity", subKey: "onb.qIdentitySub" },
  { id: "growth", titleKey: "onb.qImprove", subKey: "onb.qImproveSub" },
  { id: "pride", titleKey: "onb.qProud", subKey: "onb.qProudSub" },
  { id: "blockers", titleKey: "onb.qBlockers", subKey: "onb.qPatterns" },
  { id: "fears", titleKey: "onb.qFears", subKey: "onb.qFearsSub" },
  { id: "alive", titleKey: "onb.qAlive", subKey: "onb.qMotivate" },
];

const WORLDVIEWS = [
  { labelKey: "onb.spiritual", emoji: "✨", value: "Spiritual" },
  { labelKey: "onb.noPreference", emoji: "🌍", value: "No preference" },
  { labelKey: "onb.christian", emoji: "✝️", value: "Christianity" },
  { labelKey: "onb.islam", emoji: "☪️", value: "Islam" },
  { labelKey: "onb.buddhism", emoji: "☸️", value: "Buddhism" },
  { labelKey: "onb.hinduism", emoji: "🕉️", value: "Hinduism" },
];

interface SoulProfile {
  personality_type?: string;
  summary?: string;
  strengths?: string[];
}

export default function OnboardingScreen() {
  const user = useAuthStore((s) => s.user);
  const t = useT();
  const appFonts = useAppFonts();
  const styles = useMemo(() => makeStyles(appFonts), [appFonts]);
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
        body: { answers, worldview, language: useSettingsStore.getState().language },
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
      Alert.alert(t("common.error"), t("onb.analysisFailed"));
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
    Alert.alert(t("onb.welcomeTitle"), t("onb.profileReady"));
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
              <Text style={styles.title}>{t("onb.chooseLang")}</Text>
              <Text style={styles.subtitle}>{t("onb.langSubtitle")}</Text>
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
              <Text style={styles.stepBadge}>{t("onb.questionLabel").replace("{n}", String(step))}</Text>
              <Text style={styles.title}>{t(QUESTIONS[step - 1].titleKey)}</Text>
              <Text style={styles.subtitle}>{t(QUESTIONS[step - 1].subKey)}</Text>
              <TextInput
                style={[styles.input, shadows.soft]}
                placeholder={t("onb.answerPlaceholder")}
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
              <Text style={styles.title}>{t("onb.beliefs")}</Text>
              <Text style={styles.subtitle}>{t("onb.optional")}</Text>
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
                      <Text style={[styles.wvLabel, active && { color: colors.primary, fontWeight: "700" }]}>{t(w.labelKey)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {step === 8 && (
            <View style={styles.analyzing}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={styles.analyzingText}>{t("onb.analyzing")}</Text>
              <Text style={styles.analyzingSub}>{t("onb.aiReads")}</Text>
            </View>
          )}

          {step === 9 && profile && (
            <>
              <Text style={styles.title}>{t("onb.profileTitle")}</Text>
              {profile.personality_type && (
                <View style={[styles.card, shadows.card]}>
                  <Text style={styles.cardLabel}>{t("onb.personalityType")}</Text>
                  <Text style={styles.cardText}>{profile.personality_type}</Text>
                </View>
              )}
              {profile.summary && (
                <View style={[styles.card, shadows.card]}>
                  <Text style={styles.cardLabel}>{t("onb.summary")}</Text>
                  <Text style={styles.cardText}>{profile.summary}</Text>
                </View>
              )}
              {profile.strengths && profile.strengths.length > 0 && (
                <View style={[styles.card, shadows.card]}>
                  <Text style={styles.cardLabel}>{t("onb.strengths")}</Text>
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
              <Text style={styles.nextText}>{step === 7 ? t("onb.analyzeBtn") : t("onb.continue")}</Text>
            </Pressable>
          )}
          {isLastStep && (
            <Pressable style={[styles.nextBtn, shadows.soft]} onPress={finish}>
              <Text style={styles.nextText}>{t("onb.start")}</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const makeStyles = (appFonts: AppFonts) => StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 24, paddingBottom: 60 },
  progressWrap: { flexDirection: "row", justifyContent: "center", gap: 6, marginBottom: 24 },
  progressDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: colors.glassBorder },
  progressDotActive: { backgroundColor: colors.primary },
  title: { fontSize: 22, color: colors.text, fontFamily: appFonts.displayBold, marginBottom: 6 },
  subtitle: { fontSize: 14, color: colors.textMuted, marginBottom: 20, lineHeight: 20, fontFamily: appFonts.body },
  stepBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.primaryLight,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 4,
    fontSize: 12,
    color: colors.primary,
    fontFamily: appFonts.bodySemiBold,
    marginBottom: 10,
    overflow: "hidden",
  },
  card: { ...glassCard, padding: 16, marginBottom: 16 },
  langRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.glassBorder },
  langFlag: { fontSize: 20, marginRight: 12 },
  langName: { fontSize: 15, color: colors.text, fontFamily: appFonts.bodyMedium },
  input: {
    backgroundColor: colors.white,
    borderRadius: radius.input,
    padding: 16,
    minHeight: 140,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    fontFamily: appFonts.body,
  },
  wvRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.glassBorder },
  wvRowActive: { backgroundColor: colors.primaryLight, borderRadius: radius.input, paddingHorizontal: 10 },
  wvEmoji: { fontSize: 20, marginRight: 12 },
  wvLabel: { fontSize: 15, color: colors.text, fontFamily: appFonts.body },
  analyzing: { alignItems: "center", paddingVertical: 60 },
  analyzingText: { fontSize: 16, color: colors.text, fontFamily: appFonts.bodySemiBold, marginTop: 16 },
  analyzingSub: { fontSize: 13, color: colors.textMuted, marginTop: 6, fontFamily: appFonts.body },
  cardLabel: { fontSize: 12, color: colors.primary, fontFamily: appFonts.bodySemiBold, marginBottom: 6, textTransform: "uppercase" },
  cardText: { fontSize: 14, lineHeight: 21, color: colors.text, fontFamily: appFonts.body },
  strength: { fontSize: 14, color: colors.text, fontFamily: appFonts.body, marginTop: 4 },
  nextBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.input,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  nextText: { color: colors.white, fontSize: 16, fontWeight: "700", fontFamily: appFonts.bodyBold },
});
