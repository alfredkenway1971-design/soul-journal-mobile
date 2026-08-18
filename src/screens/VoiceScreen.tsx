import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import {
  View, Text, Pressable, StyleSheet, ScrollView, Alert, ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAudioRecorder, requestRecordingPermissionsAsync, setAudioModeAsync, createAudioPlayer, RecordingPresets } from "expo-audio";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system/legacy";
import { useNavigation } from "@react-navigation/native";
import { colors, radius, fonts, glassCard, shadows } from "@/theme";
import { useAppFonts, type AppFonts } from "@/hooks/useAppFonts";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { useT, useSettingsStore } from "@/store/settingsStore";
import { useSubscriptionStore } from "@/store/subscriptionStore";
import UpgradePrompt from "@/components/UpgradePrompt";
import { LANGUAGES } from "@/i18n/translations";

const CREATE_CLONE_URL = "https://soul-journal-seven.vercel.app/api/create-voice-clone";

/** One clone per language, stored in the voice_profiles table (same as web). */
interface VoiceProfile {
  lang: string;
  voice_id: string;
}

export default function VoiceScreen() {
  const navigation = useNavigation();
  const appFonts = useAppFonts();
  const styles = useMemo(() => makeStyles(appFonts), [appFonts]);
  const user = useAuthStore((s) => s.user);
  const t = useT();
  const language = useSettingsStore((s) => s.language);
  const isPremium = useSubscriptionStore((s) => s.isPremium);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [creating, setCreating] = useState(false);
  const [clones, setClones] = useState<VoiceProfile[]>([]);
  const [targetLang, setTargetLang] = useState<string | null>(null); // null = default clone
  const [loading, setLoading] = useState(true);
  const playerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);

  useEffect(() => {
    setAudioModeAsync({ allowsRecording: true });
    requestRecordingPermissionsAsync().catch(() => {});
    return () => {
      playerRef.current?.remove();
    };
  }, []);

  // Load all clones from the voice_profiles table (cross-device, like the web),
  // seeding the legacy profiles.voice_clone_id as the default if the table is empty
  const loadClones = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("voice_profiles")
      .select("lang, voice_id")
      .eq("user_id", user.id);
    let list = (data ?? []) as VoiceProfile[];
    if (list.length === 0) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("voice_clone_id")
        .eq("id", user.id)
        .maybeSingle();
      if (prof?.voice_clone_id) {
        // Seed under the CURRENT app language (web behavior: seedLang = normalizeLang(language) || 'en')
        const seedLang = language || "en";
        list = [{ lang: seedLang, voice_id: prof.voice_clone_id }];
        // migrate it into voice_profiles so it persists cross-device
        await supabase.from("voice_profiles").upsert(
          { user_id: user.id, lang: seedLang, voice_id: prof.voice_clone_id },
          { onConflict: "user_id,lang" }
        );
      }
    }
    setClones(list);
    setLoading(false);
  }, [user, language]);

  useEffect(() => {
    loadClones();
  }, [loadClones]);

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
      const langLabel = targetLang ? LANGUAGES.find((l) => l.code === targetLang)?.name ?? targetLang : "";
      const res = await fetch(CREATE_CLONE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          audio: base64,
          name: `Voice Clone - ${email}${langLabel ? ` - ${langLabel}` : ""}`,
          audioType: "audio/mp4",
          audioName: "voice_sample.m4a",
        }),
      });
      if (!res.ok) throw new Error(`clone ${res.status}`);
      const json = await res.json();
      if (!json?.voiceId) throw new Error("no voiceId");

      // Persist to the voice_profiles table (per-language, cross-device)
      // Default clone is keyed by the CURRENT app language (web behavior), not "default"
      const lang = targetLang ?? language ?? "en";
      const { error } = await supabase
        .from("voice_profiles")
        .upsert(
          { user_id: user.id, lang, voice_id: json.voiceId, updated_at: new Date().toISOString() },
          { onConflict: "user_id,lang" }
        );
      if (error) throw error;

      // Keep the legacy single-clone column in sync for backward compat
      if (!targetLang) {
        await supabase.from("profiles").update({ voice_clone_id: json.voiceId }).eq("id", user.id);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setRecordedUri(null);
      setTargetLang(null);
      await loadClones();
      Alert.alert("✨ Voix créée !", "Votre voix clonée est maintenant utilisée pour la lecture de vos entrées.");
    } catch (e) {
      console.warn("clone error", e);
      Alert.alert("Erreur", "Impossible de créer le clone vocal. Réessayez.");
    } finally {
      setCreating(false);
    }
  };

  const removeClone = async (lang: string) => {
    if (!user) return;
    await supabase.from("voice_profiles").delete().eq("user_id", user.id).eq("lang", lang);
    if (lang === "default") {
      await supabase.from("profiles").update({ voice_clone_id: null }).eq("id", user.id);
    }
    await loadClones();
  };

  const langName = (code: string) => LANGUAGES.find((l) => l.code === code)?.native ?? (code === "default" ? "Défaut" : code);
  const langFlag = (code: string) => LANGUAGES.find((l) => l.code === code)?.flag ?? "🌍";
  const clonedLangs = clones.map((c) => c.lang);

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
        ) : loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Clone list (per language, from the DB) */}
            {clones.length > 0 && (
              <View style={styles.listCard}>
                <Text style={styles.listTitle}>Mes voix clonées</Text>
                {clones.map((c) => (
                  <View key={c.lang} style={[styles.cloneRow, shadows.soft]}>
                    <Text style={styles.cloneFlag}>{langFlag(c.lang)}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cloneName}>{langName(c.lang)}</Text>
                      <Text style={styles.cloneId}>{c.voice_id.slice(0, 8)}…</Text>
                    </View>
                    <Pressable
                      style={styles.reRecordBtn}
                      onPress={() => { setTargetLang(c.lang); setRecordedUri(null); }}
                    >
                      <Text style={styles.reRecordText}>Ré-enregistrer</Text>
                    </Pressable>
                    <Pressable onPress={() => removeClone(c.lang)} hitSlop={8} style={{ marginLeft: 10 }}>
                      <Text style={styles.cloneDelete}>🗑️</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {/* Language target chips (add a voice in another language) */}
            <Text style={styles.sectionLabel}>Ajouter une voix dans une langue</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.langRow}>
              {LANGUAGES.map((l) => {
                const has = clonedLangs.includes(l.code);
                const active = targetLang === l.code;
                return (
                  <Pressable
                    key={l.code}
                    style={[styles.langChip, has && styles.langChipDone, active && styles.langChipActive]}
                    onPress={() => { setTargetLang(active ? null : l.code); setRecordedUri(null); }}
                  >
                    <Text style={styles.langChipText}>{l.flag} {l.native} {has ? "✓" : ""}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Recording control */}
            <View style={[styles.recordCard, shadows.card]}>
              {!isRecording ? (
                <Pressable style={styles.recordBtn} onPress={startRecording}>
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
                  <Text style={styles.createBtnText}>
                    ✨ Créer ma voix clonée{targetLang ? ` (${langName(targetLang)})` : ""}
                  </Text>
                )}
              </Pressable>
            )}

            {creating && (
              <Text style={styles.creatingHint}>
                Quelques secondes… Fish Audio entraîne le modèle (gratuit).
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const makeStyles = (appFonts: AppFonts) => StyleSheet.create({
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
  iconBtnText: { fontSize: 20, color: colors.primary, fontFamily: appFonts.bodyBold },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 18, color: colors.text, fontFamily: appFonts.displayBold },
  listCard: {
    ...glassCard,
    padding: 16,
    marginBottom: 16,
  },
  listTitle: { fontSize: 14, color: colors.text, fontFamily: appFonts.bodySemiBold, marginBottom: 10 },
  cloneRow: {
    ...glassCard,
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginBottom: 8,
  },
  cloneFlag: { fontSize: 22, marginRight: 12 },
  cloneName: { fontSize: 14, color: colors.text, fontFamily: appFonts.bodySemiBold },
  cloneId: { fontSize: 11, color: colors.textFaint, marginTop: 2, fontFamily: appFonts.body },
  reRecordBtn: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  reRecordText: { fontSize: 12, color: colors.primary, fontFamily: appFonts.bodySemiBold },
  cloneDelete: { fontSize: 16 },
  sectionLabel: { fontSize: 13, color: colors.textMuted, marginTop: 4, marginBottom: 8, fontFamily: appFonts.bodySemiBold },
  langRow: { flexDirection: "row", marginBottom: 16 },
  langChip: {
    backgroundColor: colors.cardGlass,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  langChipDone: { backgroundColor: colors.primaryLight },
  langChipActive: { borderColor: colors.primary, backgroundColor: colors.white },
  langChipText: { fontSize: 12, color: colors.text, fontFamily: appFonts.bodyMedium },
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
  recordLabel: { fontSize: 15, color: colors.text, fontFamily: appFonts.bodySemiBold },
  playBtn: {
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    paddingVertical: 12,
    paddingHorizontal: 28,
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  playBtnText: { color: colors.primary, fontSize: 14, fontWeight: "600", fontFamily: appFonts.bodySemiBold },
  createBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.input,
    paddingVertical: 16,
    alignItems: "center",
  },
  createBtnText: { color: colors.white, fontSize: 16, fontWeight: "700", fontFamily: appFonts.bodyBold },
  creatingHint: { color: colors.textMuted, fontSize: 12, textAlign: "center", marginTop: 12, fontFamily: appFonts.body },
});
