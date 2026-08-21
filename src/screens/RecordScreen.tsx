import { useEffect, useRef, useState, useMemo } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAudioRecorder, setAudioModeAsync, RecordingPresets } from "expo-audio";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system/legacy";
import { colors, radius, fonts, glassCard, shadows } from "@/theme";
import { useAppFonts, type AppFonts } from "@/hooks/useAppFonts";
import { supabase } from "@/lib/supabase";
import { ensureMicPermission } from "@/lib/micPermission";
import { generateTitle } from "@/lib/aiTitle";
import {
  pickPhoto, uploadEntryPhoto, saveEntryMedia, getEntryPhotoLimit,
  type PickedPhoto,
} from "@/lib/entryPhotos";
import { useAuthStore } from "@/store/authStore";
import { useSubscriptionStore } from "@/store/subscriptionStore";
import { useSettingsStore, useT } from "@/store/settingsStore";

const MOODS = [
  { key: "happy", labelKey: "record.moodHappy", emoji: "😊", score: 5, color: colors.mood.happy },
  { key: "good", labelKey: "record.moodGood", emoji: "😇", score: 4, color: colors.mood.good },
  { key: "fine", labelKey: "record.moodFine", emoji: "😌", score: 3, color: colors.mood.fine },
  { key: "sad", labelKey: "record.moodSad", emoji: "😔", score: 2, color: colors.mood.sad },
  { key: "unhappy", labelKey: "record.moodUnhappy", emoji: "😢", score: 1, color: colors.mood.unhappy },
];

const PROMPTS_URL = "https://soul-journal-seven.vercel.app/api/journaling-prompts";
const DREAM_URL = "https://soul-journal-seven.vercel.app/api/dream-reflection";

export default function RecordScreen() {
  const isPremium = useSubscriptionStore((s) => s.isPremium);
  const user = useAuthStore((s) => s.user);
  const appFonts = useAppFonts();
  const styles = useMemo(() => makeStyles(appFonts), [appFonts]);
  const language = useSettingsStore((s) => s.language);
  const t = useT();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [text, setText] = useState("");
  const [detectedLang, setDetectedLang] = useState<string | null>(null);
  const [mood, setMood] = useState<string>("fine");
  const [saving, setSaving] = useState(false);
  const [prompts, setPrompts] = useState<string[]>([]);
  const [promptsLoading, setPromptsLoading] = useState(false);
  const promptsFetchedRef = useRef(false);
  const [isDream, setIsDream] = useState(false);
  const [dreamReflection, setDreamReflection] = useState<string | null>(null);
  const [dreamLoading, setDreamLoading] = useState(false);
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);

  useEffect(() => {
    // iOS REQUIRES playsInSilentMode:true together with allowsRecording:true —
    // without it setAudioModeAsync throws InvalidAudioModeException and
    // record() later fails with RecordingDisabledException.
    setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    return () => {
      // recorder is a shared object from the hook; nothing to unload
    };
  }, []);

  const startRecording = async () => {
    try {
      const ok = await ensureMicPermission();
      if (!ok) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      // iOS resets the AVAudioSession category after the permission flow and
      // after any playback — re-enable recording mode right before recording.
      // iOS REQUIRES playsInSilentMode:true alongside allowsRecording:true.
      try { await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true }); } catch {}
      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
      setSeconds(0);
      const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
      (recorder as any).__timer = timer;
    } catch (e) {
      console.warn("rec start error", e);
      Alert.alert("Error", t("record.recStartError"));
    }
  };

  const stopAndTranscribe = async () => {
    try {
      recorder.stop();
      const timer = (recorder as any).__timer;
      if (timer) clearInterval(timer);
    } catch {}
    setIsRecording(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const uri = recorder.uri;
    if (!uri) {
      Alert.alert("Error", t("record.noAudio"));
      return;
    }
    setIsTranscribing(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const { data, error } = await supabase.functions.invoke("transcribe-audio", {
        body: { audio: base64, language },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      if (data?.text) {
        setText((prev) => (prev ? prev + "\n" : "") + data.text.trim());
        if (data?.language) setDetectedLang(data.language);
      } else Alert.alert("Transcription", t("record.noText"));
    } catch (e) {
      console.warn("transcribe error", e);
      Alert.alert(t("record.transcribeFailed"), t("record.transcribeRetry"));
    } finally {
      setIsTranscribing(false);
    }
  };

  /* ── Photos (web parity: journal-photos bucket + entry_media rows) ── */

  const addPhoto = async (source: "camera" | "library") => {
    const photoLimit = getEntryPhotoLimit(isPremium);
    if (photos.length >= photoLimit) {
      Alert.alert(t("record.photosTitle"), t("record.photoLimit"));
      return;
    }
    const res = await pickPhoto(source);
    if (res.status === "denied") {
      Alert.alert(t("common.error"), t("record.photosDenied"));
      return;
    }
    if (res.status === "ok") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPhotos((prev) => [...prev, res.photo].slice(0, photoLimit));
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const saveEntry = async () => {
    const content = text.trim();
    if (!content) {
      Alert.alert("Empty entry", t("record.empty"));
      return;
    }
    if (!user) return;
    setSaving(true);
    try {
      const words = content.split(/\s+/);
      const fallbackTitle = words.slice(0, 6).join(" ").slice(0, 60) + (words.length > 6 ? "…" : "");
      // Web parity: AI-generated title from the entry summary (fallback = first words)
      let title = fallbackTitle;
      try {
        const aiTitle = await generateTitle(content, detectedLang ?? language);
        if (aiTitle) title = aiTitle;
      } catch {}
      const moodObj = MOODS.find((m) => m.key === mood)!;
      const { data: inserted, error } = await supabase.from("journal_entries").insert({
        user_id: user.id,
        title,
        enhanced_text: content,
        original_transcription: content,
        mood,
        mood_score: moodObj.score,
        detected_language: detectedLang ?? language,
        playback_language: detectedLang ?? language,
        created_at: new Date().toISOString(),
      }).select("id");
      if (error) throw error;
      const entryId = inserted?.[0]?.id as string | undefined;
      // Upload attached photos and link them (web parity: entry_media rows).
      // Per-photo try/catch: a photo failure never loses the entry itself.
      if (entryId && photos.length > 0) {
        for (const photo of photos) {
          try {
            const storagePath = await uploadEntryPhoto(photo, user.id);
            await saveEntryMedia(entryId, storagePath);
          } catch (e) {
            console.warn("photo upload failed", e);
          }
        }
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setText("");
      setMood("fine");
      setPhotos([]);
      if (isDream) {
        setIsDream(false);
        generateDreamReflection(content);
      }
      // Soul Mirror reflection in the background (web parity — fire and forget)
      if (entryId && content.trim()) {
        generateSoulReflection(entryId, content);
      }
      Alert.alert(`✨ ${t("record.saved")}`, t("record.savedDesc"));
    } catch (e) {
      console.warn("save error", e);
      Alert.alert("Error", t("record.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const loadPrompts = async () => {
    if (!user || promptsLoading) return;
    setPromptsLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("no session");

      const { data: recent } = await supabase
        .from("journal_entries")
        .select("title, enhanced_text, original_transcription")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(7);
      const recentEntries = (recent ?? []).map((r) =>
        (r.title || r.enhanced_text || r.original_transcription || "").substring(0, 200)
      );

      const langName = { en: "English", fr: "French", es: "Spanish", ar: "Arabic", zh: "Chinese", ja: "Japanese", sw: "Swahili", de: "German" }[language] ?? "French";
      const res = await fetch(PROMPTS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ recentEntries, goals: [], language: langName, styleSamples: [] }),
      });
      if (!res.ok) throw new Error(`prompts ${res.status}`);
      const json = await res.json();
      if (Array.isArray(json?.prompts) && json.prompts.length > 0) setPrompts(json.prompts.slice(0, 3));
    } catch (e) {
      console.warn("prompts error", e);
      Alert.alert(t("record.promptsTitle"), t("record.promptsFailed"));
    } finally {
      setPromptsLoading(false);
    }
  };

  const refreshPrompts = async () => {
    setPrompts([]);
    await loadPrompts();
  };

  const generateDreamReflection = async (dreamText: string) => {
    if (!user) return;
    setDreamLoading(true);
    setDreamReflection(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("no session");

      const { data: recent } = await supabase
        .from("journal_entries")
        .select("enhanced_text, original_transcription")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);
      const recentEntries = (recent ?? [])
        .map((r) => (r.enhanced_text || r.original_transcription || "").substring(0, 300))
        .filter(Boolean);

      const res = await fetch(DREAM_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ dreamText, recentEntries, language: "French" }),
      });
      if (!res.ok) throw new Error(`dream ${res.status}`);
      const json = await res.json();
      if (json?.reflection) setDreamReflection(json.reflection);
    } catch (e) {
      console.warn("dream error", e);
    } finally {
      setDreamLoading(false);
    }
  };

  const generateSoulReflection = async (entryId: string, entryText: string) => {
    if (!user) return;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("no session");

      // Profile context for a personalized reflection (web parity)
      const { data: prof } = await supabase
        .from("profiles")
        .select("goals, fears, strengths, worldview, soul_profile_summary")
        .eq("id", user.id)
        .maybeSingle();

      const res = await supabase.functions.invoke("generate-soul-reflection", {
        body: {
          entryText,
          goals: (prof as any)?.goals || [],
          fears: (prof as any)?.fears || [],
          strengths: (prof as any)?.strengths || [],
          worldview: (prof as any)?.worldview || null,
          soulProfileSummary: (prof as any)?.soul_profile_summary || null,
          language: language === "fr" ? "French" : language === "es" ? "Spanish" : language === "ar" ? "Arabic" : language === "sw" ? "Swahili" : language === "zh" ? "Chinese" : language === "ja" ? "Japanese" : language === "de" ? "German" : "English",
        },
      });
      if (res.error) throw res.error;
      const reflection = (res.data as any)?.reflection as string | undefined;
      if (reflection) {
        await supabase.from("journal_entries").update({ soul_reflection: reflection }).eq("id", entryId);
      }
    } catch (e) {
      console.warn("soul reflection error", e); // fire-and-forget: never block saving
    }
  };

  // Load prompts once per screen visit (blank write screen)
  useEffect(() => {
    if (!promptsFetchedRef.current && user) {
      promptsFetchedRef.current = true;
      loadPrompts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <LinearGradient colors={[colors.bgTop, colors.bgMid, colors.bgBottom]} style={styles.root}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>🎙️ {t("record.title")}</Text>
        <Text style={styles.subtitle}>{t("record.subtitle")}</Text>

        {/* Voice recording */}
        <View style={[styles.card, shadows.card]}>
          {!isRecording ? (
            <Pressable style={[styles.micButton, isTranscribing && { opacity: 0.5 }]} onPress={startRecording} disabled={isTranscribing}>
              <View style={styles.micCircle}>
                <Text style={styles.micIcon}>🎤</Text>
              </View>
              <Text style={styles.micLabel}>{isTranscribing ? t("record.transcribing") : t("record.pressToRecord")}</Text>
            </Pressable>
          ) : (
            <Pressable style={[styles.micButton, styles.micActive]} onPress={stopAndTranscribe}>
              <View style={[styles.micCircle, styles.micCircleActive]}>
                <Text style={styles.micIcon}>⏹️</Text>
              </View>
              <Text style={styles.micLabel}>{t("record.stop")} ({seconds}s)</Text>
            </Pressable>
          )}
          {isTranscribing && <ActivityIndicator style={{ marginTop: 12 }} color={colors.primary} />}
        </View>

        {/* Text area */}
        <TextInput
          style={[styles.textInput, shadows.soft]}
          placeholder={t("record.orType")}
          placeholderTextColor={colors.textFaint}
          multiline
          value={text}
          onChangeText={setText}
          textAlignVertical="top"
        />

        {/* Photos (web parity: attach pictures to the entry → they appear in the Soul Book PDF) */}
        <View style={[styles.photosCard, shadows.soft]}>
          <View style={styles.photosHeader}>
            <Text style={styles.photosTitle}>🖼️ {t("record.photosTitle")}</Text>
            {photos.length > 0 && (
              <Text style={styles.photosCount}>{photos.length}/{getEntryPhotoLimit(isPremium)}</Text>
            )}
          </View>
          <View style={styles.photoButtons}>
            <Pressable style={styles.photoBtn} onPress={() => addPhoto("camera")}>
              <Text style={styles.photoBtnText}>📷 {t("record.takePhoto")}</Text>
            </Pressable>
            <Pressable style={styles.photoBtn} onPress={() => addPhoto("library")}>
              <Text style={styles.photoBtnText}>🖼️ {t("record.fromLibrary")}</Text>
            </Pressable>
          </View>
          {photos.length > 0 && (
            <View style={styles.photoRow}>
              {photos.map((p, i) => (
                <View key={`${p.uri}-${i}`} style={styles.photoWrap}>
                  <Image source={{ uri: p.uri }} style={styles.photoThumb} />
                  <Pressable style={styles.photoRemove} onPress={() => removePhoto(i)} hitSlop={8}>
                    <Text style={styles.photoRemoveText}>✕</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* AI writing ideas (Smart Prompts) */}
        {(prompts.length > 0 || promptsLoading) && (
          <View style={[styles.promptsCard, shadows.soft]}>
            <View style={styles.promptsHeader}>
              <Text style={styles.promptsTitle}>{t("record.promptsTitle")}</Text>
              <Pressable onPress={refreshPrompts} disabled={promptsLoading} hitSlop={8}>
                <Text style={styles.promptsRefresh}>
                  {promptsLoading ? t("record.promptsGenerating") : t("record.promptsRefresh")}
                </Text>
              </Pressable>
            </View>
            {prompts.map((p, i) => (
              <Pressable
                key={i}
                style={styles.promptChip}
                onPress={() => setText((prev) => (prev ? prev + "\n" : "") + p)}
              >
                <Text style={styles.promptText}>💡 {p}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Always-visible trigger when no prompts are loaded yet */}
        {prompts.length === 0 && !promptsLoading && (
          <Pressable style={styles.promptTrigger} onPress={loadPrompts} disabled={promptsLoading}>
            <Text style={styles.promptTriggerText}>✨ {t("record.promptsTitle")}</Text>
          </Pressable>
        )}

        {/* Mood */}
        <Text style={styles.sectionLabel}>{t("record.howFeel")}</Text>
        <View style={styles.moodRow}>
          {MOODS.map((m) => {
            const active = mood === m.key;
            return (
              <Pressable
                key={m.key}
                onPress={() => setMood(m.key)}
                style={[styles.moodChip, shadows.soft, active && { borderColor: m.color, backgroundColor: colors.white }]}
              >
                <Text style={styles.moodEmoji}>{m.emoji}</Text>
                <Text style={[styles.moodLabel, active && { color: m.color, fontWeight: "700" }]}>
                  {t(m.labelKey)}
                </Text>
                {active && <View style={[styles.moodDot, { backgroundColor: m.color }]} />}
              </Pressable>
            );
          })}
        </View>

        {/* Dream toggle */}
        <Pressable
          style={[styles.dreamChip, isDream && styles.dreamChipActive]}
          onPress={() => setIsDream((v) => !v)}
        >
          <Text style={styles.dreamChipText}>🌙 {isDream ? t("record.dreamMarked") : t("record.markDream")}</Text>
        </Pressable>

        {/* Dream reflection result */}
        {(dreamReflection || dreamLoading) && (
          <View style={[styles.dreamCard, shadows.card]}>
            <Text style={styles.dreamTitle}>{t("record.dreamReflection")}</Text>
            {dreamLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} />
            ) : (
              <Text style={styles.dreamText}>{dreamReflection}</Text>
            )}
          </View>
        )}

        </ScrollView>
        {/* Save = fixed footer, always visible above the keyboard (2026-08-19) */}
        <View style={styles.saveFooter}>
          <Pressable style={[styles.saveButton, shadows.soft, saving && { opacity: 0.6 }]} onPress={saveEntry} disabled={saving}>
            <Text style={styles.saveText}>{saving ? t("record.saving") : `${t("record.save")} ✨`}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const makeStyles = (appFonts: AppFonts) => StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, paddingBottom: 110 },
  title: {
    fontSize: 26,
    color: colors.text,
    fontFamily: appFonts.displayBold,
  },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 4, marginBottom: 20, fontFamily: appFonts.body },
  card: {
    ...glassCard,
    padding: 20,
    alignItems: "center",
  },
  micButton: {
    borderRadius: 999,
    paddingVertical: 18,
    paddingHorizontal: 24,
    alignItems: "center",
    width: "100%",
  },
  micCircle: {
    width: 72,
    height: 72,
    borderRadius: 999,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    borderWidth: 2,
    borderColor: "rgba(29,129,237,0.25)",
  },
  micCircleActive: { backgroundColor: "#fee2e2", borderColor: "rgba(239,68,68,0.35)" },
  micActive: {},
  micIcon: { fontSize: 32 },
  micLabel: { fontSize: 15, color: colors.text, marginTop: 2, fontFamily: appFonts.bodySemiBold },
  textInput: {
    backgroundColor: colors.cardGlassStrong,
    borderRadius: radius.card,
    padding: 16,
    minHeight: 140,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    marginTop: 16,
    marginBottom: 20,
    fontFamily: appFonts.body,
  },
  sectionLabel: { fontSize: 14, color: colors.text, marginBottom: 10, fontFamily: appFonts.bodySemiBold },
  photosCard: {
    ...glassCard,
    padding: 16,
    marginBottom: 20,
  },
  photosHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  photosTitle: { fontSize: 14, color: colors.text, fontFamily: appFonts.bodySemiBold },
  photosCount: { fontSize: 12, color: colors.textMuted, fontFamily: appFonts.body },
  photoButtons: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  photoBtn: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.input,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(29,129,237,0.2)",
    flexGrow: 1,
    alignItems: "center",
  },
  photoBtnText: { fontSize: 13, color: colors.primary, fontFamily: appFonts.bodySemiBold },
  photoRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  photoWrap: { position: "relative" },
  photoThumb: {
    width: 68,
    height: 68,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.cardGlassStrong,
  },
  photoRemove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  photoRemoveText: { color: colors.white, fontSize: 11, fontWeight: "700" },
  promptsCard: {
    ...glassCard,
    padding: 16,
    marginBottom: 20,
  },
  promptsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  promptsTitle: { fontSize: 14, color: colors.text, fontFamily: appFonts.bodySemiBold },
  promptsRefresh: { fontSize: 12, color: colors.primary, fontFamily: appFonts.bodySemiBold },
  promptChip: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.input,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  promptText: { fontSize: 13, color: colors.text, lineHeight: 19, fontFamily: appFonts.body },
  promptTrigger: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.input,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(29,129,237,0.2)",
  },
  promptTriggerText: { fontSize: 13, color: colors.primary, fontFamily: appFonts.bodySemiBold },
  moodRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 24 },
  moodChip: {
    backgroundColor: colors.cardGlass,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: "center",
    minWidth: 64,
  },
  moodEmoji: { fontSize: 20 },
  moodLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2, fontFamily: appFonts.body },
  moodDot: { width: 5, height: 5, borderRadius: 999, marginTop: 4 },
  dreamChip: {
    backgroundColor: colors.cardGlass,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.glassBorder,
    marginBottom: 16,
  },
  dreamChipActive: { backgroundColor: "#fdf3f3", borderColor: "#c9a3b8" },
  dreamChipText: { fontSize: 13, color: colors.text, fontFamily: appFonts.bodySemiBold },
  dreamCard: {
    ...glassCard,
    padding: 18,
    marginBottom: 16,
    backgroundColor: "rgba(255,255,255,0.8)",
  },
  dreamTitle: { fontSize: 14, color: colors.text, fontFamily: appFonts.displayBold, marginBottom: 8 },
  dreamText: { fontSize: 14, lineHeight: 21, color: colors.text, fontFamily: appFonts.body },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.input,
    paddingVertical: 16,
    alignItems: "center",
  },
  saveText: { color: colors.white, fontSize: 16, fontWeight: "700", fontFamily: appFonts.bodyBold },
  saveFooter: {
    padding: 16,
    paddingTop: 10,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
});
