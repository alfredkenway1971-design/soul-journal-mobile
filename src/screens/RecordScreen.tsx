import { useEffect, useRef, useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView, Alert, ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system/legacy";
import { colors, radius, fonts, glassCard, shadows } from "@/theme";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { useSettingsStore, useT } from "@/store/settingsStore";

const MOODS = [
  { key: "happy", labelKey: "record.moodHappy", emoji: "😊", score: 5, color: colors.mood.happy },
  { key: "good", labelKey: "record.moodGood", emoji: "😇", score: 4, color: colors.mood.good },
  { key: "fine", labelKey: "record.moodFine", emoji: "😌", score: 3, color: colors.mood.fine },
  { key: "sad", labelKey: "record.moodSad", emoji: "😔", score: 2, color: colors.mood.sad },
  { key: "unhappy", labelKey: "record.moodUnhappy", emoji: "😢", score: 1, color: colors.mood.unhappy },
];

export default function RecordScreen() {
  const user = useAuthStore((s) => s.user);
  const language = useSettingsStore((s) => s.language);
  const t = useT();
  const recordingRef = useRef<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [text, setText] = useState("");
  const [detectedLang, setDetectedLang] = useState<string | null>(null);
  const [mood, setMood] = useState<string>("fine");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t("auth.privacy"), t("auth.micDenied"));
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        // expo-av 16: Android MediaRecorder (AAC/m4a) — no PCM/WAV output.
        // m4a -> WAV conversion happens on the VPS converter,
        // mirroring the web app's client-side webm->wav step.
        android: {
          extension: ".m4a",
          outputFormat: Audio.AndroidOutputFormat.DEFAULT,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: ".m4a",
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        web: { mimeType: "audio/mp4" },
      });
      recordingRef.current = recording;
      setIsRecording(true);
      setSeconds(0);
      await recording.startAsync();
      const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
      (recording as any).__timer = timer;
    } catch (e) {
      Alert.alert("Error", t("record.recStartError"));
      console.warn("rec start error", e);
    }
  };

  const stopAndTranscribe = async () => {
    const rec = recordingRef.current;
    if (!rec) return;
    try {
      await rec.stopAndUnloadAsync();
      const timer = (rec as any).__timer;
      if (timer) clearInterval(timer);
    } catch {}
    recordingRef.current = null;
    setIsRecording(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const uri = rec.getURI();
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
      const title = words.slice(0, 6).join(" ").slice(0, 60) + (words.length > 6 ? "…" : "");
      const moodObj = MOODS.find((m) => m.key === mood)!;
      const { error } = await supabase.from("journal_entries").insert({
        user_id: user.id,
        title,
        enhanced_text: content,
        original_transcription: content,
        mood,
        mood_score: moodObj.score,
        detected_language: detectedLang ?? language,
        created_at: new Date().toISOString(),
      });
      if (error) throw error;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setText("");
      setMood("fine");
      Alert.alert(`✨ ${t("record.saved")}`, t("record.savedDesc"));
    } catch (e) {
      console.warn("save error", e);
      Alert.alert("Error", t("record.saveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <LinearGradient colors={[colors.bgTop, colors.bgMid, colors.bgBottom]} style={styles.root}>
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

        <Pressable style={[styles.saveButton, shadows.soft, saving && { opacity: 0.6 }]} onPress={saveEntry} disabled={saving}>
          <Text style={styles.saveText}>{saving ? t("record.saving") : `${t("record.save")} ✨`}</Text>
        </Pressable>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, paddingBottom: 110 },
  title: {
    fontSize: 26,
    color: colors.text,
    fontFamily: fonts.displayBold,
  },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 4, marginBottom: 20, fontFamily: fonts.body },
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
  micLabel: { fontSize: 15, color: colors.text, marginTop: 2, fontFamily: fonts.bodySemiBold },
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
    fontFamily: fonts.body,
  },
  sectionLabel: { fontSize: 14, color: colors.text, marginBottom: 10, fontFamily: fonts.bodySemiBold },
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
  moodLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2, fontFamily: fonts.body },
  moodDot: { width: 5, height: 5, borderRadius: 999, marginTop: 4 },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.input,
    paddingVertical: 16,
    alignItems: "center",
  },
  saveText: { color: colors.white, fontSize: 16, fontWeight: "700", fontFamily: fonts.bodyBold },
});
