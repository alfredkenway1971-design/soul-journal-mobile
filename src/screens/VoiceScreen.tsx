import { useEffect, useRef, useState } from "react";
import {
  View, Text, Pressable, StyleSheet, ScrollView, Alert, ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAudioRecorder, requestRecordingPermissionsAsync, setAudioModeAsync, createAudioPlayer, RecordingPresets } from "expo-audio";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system/legacy";
import { useNavigation } from "@react-navigation/native";
import { colors, radius, fonts, glassCard, shadows } from "@/theme";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { useT } from "@/store/settingsStore";
import { useSubscriptionStore } from "@/store/subscriptionStore";
import UpgradePrompt from "@/components/UpgradePrompt";

const CREATE_CLONE_URL = "https://soul-journal-seven.vercel.app/api/create-voice-clone";
const MIN_RECORD_MS = 10000;

export default function VoiceScreen() {
  const navigation = useNavigation();
  const user = useAuthStore((s) => s.user);
  const t = useT();
  const isPremium = useSubscriptionStore((s) => s.isPremium);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [creating, setCreating] = useState(false);
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const playerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);

  useEffect(() => {
    setAudioModeAsync({ allowsRecording: true });
    // Pre-request mic permission on screen open (only asks once per install).
    requestRecordingPermissionsAsync().catch(() => {});
    return () => {
      playerRef.current?.remove();
    };
  }, []);

  // Load existing clone id from the profile
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("voice_clone_id")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.voice_clone_id) setVoiceId(data.voice_clone_id);
      });
  }, [user]);

  const stopPlayback = async () => {
    const p = playerRef.current;
    playerRef.current = null;
    if (p) {
      try { p.pause(); p.remove(); } catch {}
    }
    setPlaying(false);
  };

  const togglePlay = async () => {
    if (playing) { await stopPlayback(); return; }
    if (!recordedUri) return;
    try {
      const player = createAudioPlayer({ uri: recordedUri });
      playerRef.current = player;
      player.addListener("playbackStatusUpdate", (st) => {
        if (st.playbackState === "ended") {
          setPlaying(false);
          player.remove();
          playerRef.current = null;
        }
      });
      player.play();
      setPlaying(true);
    } catch {
      Alert.alert("Error", "Impossible de lire l'échantillon.");
    }
  };

  const startRecording = async () => {
    try {
      await stopPlayback();
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t("auth.privacy"), t("auth.micDenied"));
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
      setSeconds(0);
      setRecordedUri(null);
      const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
      (recorder as any).__timer = timer;
    } catch (e) {
      console.warn("rec error", e);
      Alert.alert("Error", t("record.recStartError"));
    }
  };

  const stopRecording = async () => {
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
    setRecordedUri(uri);
  };

  const createClone = async () => {
    if (!recordedUri) return;
    if (seconds < 10) {
      Alert.alert("Voice clone", "L'échantillon doit durer au moins 10 secondes.");
      return;
    }
    if (!user) return;
    setCreating(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(recordedUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("no session");

      const email = user.email ?? "user";
      const res = await fetch(CREATE_CLONE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          audio: base64,
          name: `Voice Clone - ${email}`,
          audioType: "audio/mp4",
          audioName: "voice_sample.m4a",
        }),
      });
      if (!res.ok) throw new Error(`clone ${res.status}`);
      const json = await res.json();
      if (!json?.voiceId) throw new Error("no voiceId");

      // Persist to the profile so playback uses this voice everywhere
      const { error } = await supabase
        .from("profiles")
        .update({ voice_clone_id: json.voiceId })
        .eq("id", user.id);
      if (error) throw error;

      setVoiceId(json.voiceId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("✨ Voix créée !", "Votre voix clonée est maintenant utilisée pour la lecture de vos entrées.");
    } catch (e) {
      console.warn("clone error", e);
      Alert.alert("Erreur", "Impossible de créer le clone vocal. Réessayez.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <LinearGradient colors={[colors.bgTop, colors.bgMid, colors.bgBottom]} style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.iconBtnText}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>🎙️ {t("profile.voice")}</Text>
          <View style={{ width: 40 }} />
        </View>

        {!isPremium ? (
          <UpgradePrompt
            title="La voix clonée est une fonction Premium"
            description="Enregistrez un échantillon de 10 secondes et l'IA reproduit votre voix pour lire vos entrées."
          />
        ) : voiceId ? (
          <View style={[styles.statusCard, shadows.card]}>
            <Text style={styles.statusEmoji}>✅</Text>
            <Text style={styles.statusTitle}>Voix clonée active</Text>
            <Text style={styles.statusDesc}>
              Vos entrées sont lues avec votre voix. Pour changer de voix, enregistrez un nouvel échantillon.
            </Text>
          </View>
        ) : (
          <View style={[styles.statusCard, shadows.card]}>
            <Text style={styles.statusEmoji}>🎤</Text>
            <Text style={styles.statusTitle}>Créez votre voix</Text>
            <Text style={styles.statusDesc}>
              Enregistrez un échantillon d'au moins 10 secondes. L'IA reproduit votre voix pour lire vos entrées.
            </Text>
          </View>
        )}

        {/* Recording control */}
        <View style={[styles.recordCard, shadows.card]}>
          {!isRecording ? (
            <Pressable style={styles.recordBtn} onPress={recordedUri ? startRecording : startRecording}>
              <View style={styles.recordCircle}>
                <Text style={styles.recordIcon}>{recordedUri ? "🔁" : "🎤"}</Text>
              </View>
              <Text style={styles.recordLabel}>
                {recordedUri ? "Ré-enregistrer" : t("record.pressToRecord")}
              </Text>
            </Pressable>
          ) : (
            <Pressable style={styles.recordBtn} onPress={stopRecording}>
              <View style={[styles.recordCircle, styles.recordCircleActive]}>
                <Text style={styles.recordIcon}>⏹️</Text>
              </View>
              <Text style={styles.recordLabel}>{t("record.stop")} ({seconds}s)</Text>
            </Pressable>
          )}

          {recordedUri && !isRecording && (
            <Pressable style={[styles.playBtn, shadows.soft]} onPress={togglePlay}>
              <Text style={styles.playBtnText}>{playing ? "⏸ Arrêter" : "▶️ Écouter l'échantillon"}</Text>
            </Pressable>
          )}
        </View>

        {/* Create button */}
        {recordedUri && !isRecording && (
          <Pressable style={[styles.createBtn, shadows.soft, creating && { opacity: 0.6 }]} onPress={createClone} disabled={creating}>
            {creating ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.createBtnText}>✨ Créer ma voix clonée</Text>
            )}
          </Pressable>
        )}

        {creating && (
          <Text style={styles.creatingHint}>
            Quelques secondes… Fish Audio entraîne le modèle (gratuit).
          </Text>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: colors.cardGlassStrong,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  iconBtnText: { fontSize: 20, color: colors.primary, fontFamily: fonts.bodyBold },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 18, color: colors.text, fontFamily: fonts.displayBold },
  statusCard: {
    ...glassCard,
    padding: 20,
    alignItems: "center",
    marginBottom: 16,
  },
  statusEmoji: { fontSize: 34, marginBottom: 8 },
  statusTitle: { fontSize: 17, color: colors.text, fontFamily: fonts.display, textAlign: "center" },
  statusDesc: { fontSize: 13, color: colors.textMuted, marginTop: 6, textAlign: "center", lineHeight: 19, fontFamily: fonts.body },
  recordCard: {
    ...glassCard,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
  },
  recordBtn: { alignItems: "center", width: "100%" },
  recordCircle: {
    width: 84,
    height: 84,
    borderRadius: 999,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "rgba(29,129,237,0.25)",
  },
  recordCircleActive: { backgroundColor: "#fee2e2", borderColor: "rgba(239,68,68,0.35)" },
  recordIcon: { fontSize: 36 },
  recordLabel: { fontSize: 15, color: colors.text, fontFamily: fonts.bodySemiBold },
  playBtn: {
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    paddingVertical: 12,
    paddingHorizontal: 28,
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  playBtnText: { color: colors.primary, fontSize: 14, fontWeight: "600", fontFamily: fonts.bodySemiBold },
  createBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.input,
    paddingVertical: 16,
    alignItems: "center",
  },
  createBtnText: { color: colors.white, fontSize: 16, fontWeight: "700", fontFamily: fonts.bodyBold },
  creatingHint: { color: colors.textMuted, fontSize: 12, textAlign: "center", marginTop: 12, fontFamily: fonts.body },
});
