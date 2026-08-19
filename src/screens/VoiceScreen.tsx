import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import {
  View, Text, Pressable, StyleSheet, ScrollView, Alert, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAudioRecorder, setAudioModeAsync, createAudioPlayer, RecordingPresets } from "expo-audio";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system/legacy";
import { useNavigation } from "@react-navigation/native";
import { colors, radius, fonts, glassCard, shadows } from "@/theme";
import { useAppFonts, type AppFonts } from "@/hooks/useAppFonts";
import { supabase } from "@/lib/supabase";
import { ensureMicPermission } from "@/lib/micPermission";
import { useAuthStore } from "@/store/authStore";
import { useT, useSettingsStore } from "@/store/settingsStore";
import { useSubscriptionStore } from "@/store/subscriptionStore";
import UpgradePrompt from "@/components/UpgradePrompt";
import { fetchVoiceProfiles, saveVoiceProfile, removeVoiceProfile } from "@/lib/voiceProfiles";
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
  // Uploaded-sample metadata (kept so the API receives the file's real type/name)
  const [uploadedMeta, setUploadedMeta] = useState<{ name: string; mime: string } | null>(null);
  const [sampleDuration, setSampleDuration] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [creating, setCreating] = useState(false);
  const [clones, setClones] = useState<VoiceProfile[]>([]);
  const [targetLang, setTargetLang] = useState<string | null>(null); // null = default clone
  const [loading, setLoading] = useState(true);
  const playerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);

  useEffect(() => {
    // iOS REQUIRES playsInSilentMode:true together with allowsRecording:true —
    // without it setAudioModeAsync throws InvalidAudioModeException and
    // record() later fails with RecordingDisabledException.
    setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    return () => {
      playerRef.current?.remove();
    };
  }, []);

  // Load all clones via the edge function (table has no RLS — direct reads fail),
  // seeding the legacy profiles.voice_clone_id as the default if the table is empty
  const loadClones = useCallback(async () => {
    if (!user) return;
    let list: VoiceProfile[] = [];
    try {
      list = await fetchVoiceProfiles();
    } catch (e) {
      console.warn("fetchVoiceProfiles failed", e);
    }
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
        try {
          await saveVoiceProfile(seedLang, prof.voice_clone_id);
        } catch (e) {
          console.warn("seed voice profile failed", e);
        }
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
      // Guard: confirm the file actually exists locally before playing
      // (content:// URIs from the picker are not playable by expo-audio).
      const f = new File(recordedUri);
      if (!f.exists) {
        Alert.alert("Erreur", t("voice.fileInaccessible"));
        return;
      }
      const player = createAudioPlayer({ uri: recordedUri });
      playerRef.current = player;
      // Route audio to the speaker for playback (recording mode can mute it)
      try { await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }); } catch {}
      player.addListener("playbackStatusUpdate", (st) => {
        if (st.playbackState === "ended") {
          setPlaying(false);
          player.remove();
          playerRef.current = null;
        }
      });
      await player.play();
      setPlaying(true);
    } catch (e) {
      console.warn("play error", e);
      setPlaying(false);
      Alert.alert("Erreur", t("voice.playFailed"));
    }
  };

  const startRecording = async () => {
    try {
      await stopPlayback();
      const ok = await ensureMicPermission();
      if (!ok) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      // Back to recording mode (playback sets allowsRecording:false).
      // iOS REQUIRES playsInSilentMode:true alongside allowsRecording:true.
      try { await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true }); } catch {}
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
    setUploadedMeta(null); setSampleDuration(null); // live recording → default type/name
  };

  /** Measure an audio file's duration (seconds) via expo-audio. */
  const measureDuration = async (uri: string): Promise<number | null> => {
    try {
      const probe = createAudioPlayer({ uri });
      const dur = await new Promise<number>((resolve) => {
        const t = setTimeout(() => resolve(0), 6000);
        probe.addListener("playbackStatusUpdate", (st) => {
          if (st.duration && st.duration > 0) {
            clearTimeout(t);
            resolve(st.duration);
          }
        });
      });
      probe.remove();
      return dur || null;
    } catch {
      return null;
    }
  };

  /** Pick an existing audio file (mp3/wav/m4a) to use as the clone sample. */
  const pickAudio = async () => {
    try {
      await stopPlayback();
      const res = await DocumentPicker.getDocumentAsync({
        type: ["audio/*"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled || !res.assets?.length) return;
      const asset = res.assets[0];
      if (!asset.uri) return;
      const name = asset.name || "voice_sample";
      const mime = asset.mimeType || "audio/mpeg";
      // Fish accepts mp3/wav/m4a/webm — reject unsupported types early
      if (!/^(audio|application\/octet-stream)/i.test(mime) && !/\.(mp3|wav|m4a|webm|ogg|aac|flac)$/i.test(name)) {
        Alert.alert(t("voice.unsupportedFormat"), t("voice.unsupportedMsg"));
        return;
      }
      // Vercel serverless body limit ~4.5MB — keep uploads under it (base64 inflates ~33%)
      if (asset.size && asset.size > 3.2 * 1024 * 1024) {
        Alert.alert(t("voice.tooLarge"), "Utilisez un audio de moins de 3 Mo (ou raccourcissez l'enregistrement).");
        return;
      }
      // Normalize to a readable file:// URI — DocumentPicker can return a
      // content:// URI that expo-audio cannot play. Copy into the app cache.
      let playableUri = asset.uri;
      try {
        const ext = (name.split(".").pop() || "mp3").toLowerCase();
        const dest = new File(Paths.cache, `voice-sample-${Date.now()}.${ext}`);
        const src = new File(asset.uri);
        if (src.exists) {
          src.copy(dest);
          playableUri = dest.uri;
        }
      } catch (e) {
        console.warn("cache copy failed, using original uri", e);
      }
      setRecordedUri(playableUri);
      setUploadedMeta({ name, mime });
      // Measure the sample — Fish requires ~10s minimum; warn early (web parity)
      const dur = await measureDuration(playableUri);
      setSampleDuration(dur);
      if (dur !== null && dur > 0 && dur < 10) {
        Alert.alert(
          t("voice.sampleTooShort"),
          t("voice.sampleTooShortMsg")
        );
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.warn("pick error", e);
      Alert.alert("Erreur", t("voice.pickFailed"));
    }
  };

  const createClone = async () => {
    if (!recordedUri) return;
    // Live recordings must be >= 10s (timer); uploaded files use measured duration
    if (!uploadedMeta && seconds < 10) {
      Alert.alert(t("voice.sampleTooShort"), t("voice.sampleTooShortMsg"));
      return;
    }
    if (uploadedMeta && sampleDuration !== null && sampleDuration > 0 && sampleDuration < 10) {
      Alert.alert(t("voice.sampleTooShort"), t("voice.sampleTooShortMsg"));
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
          audioType: uploadedMeta?.mime ?? "audio/mp4",
          audioName: uploadedMeta?.name ?? "voice_sample.m4a",
        }),
      });
      if (!res.ok) {
        // Read the server's error detail (Fish's reason) for a useful message
        let detail = "";
        try {
          const j = await res.json();
          detail = j?.error || "";
        } catch {}
        throw new Error(detail || `clone ${res.status}`);
      }
      const json = await res.json();
      if (!json?.voiceId) throw new Error("no voiceId");

      // Persist via the edge function (per-language, cross-device)
      // Default clone is keyed by the CURRENT app language (web behavior), not "default"
      const lang = targetLang ?? language ?? "en";
      await saveVoiceProfile(lang, json.voiceId);

      // Keep the legacy single-clone column in sync for backward compat
      if (!targetLang) {
        await supabase.from("profiles").update({ voice_clone_id: json.voiceId }).eq("id", user.id);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setRecordedUri(null);
      setUploadedMeta(null); setSampleDuration(null);
      const createdLang = targetLang ?? language ?? "en";
      const createdName = LANGUAGES.find((l) => l.code === createdLang)?.native ?? createdLang;
      setTargetLang(null);
      await loadClones();
      Alert.alert(
        t("voice.cloneSuccess"),
        `${t("voice.cloneSuccessMsg")}`
      );
    } catch (e: any) {
      console.warn("clone error", e?.message || e);
      const msg = e?.message || "";
      // Show Fish's real reason when available (e.g. sample too short)
      Alert.alert(
        "Erreur",
        msg.startsWith("clone") || !msg
          ? t("voice.cloneFailed")
          : msg
      );
    } finally {
      setCreating(false);
    }
  };

  const removeClone = async (lang: string) => {
    if (!user) return;
    try {
      await removeVoiceProfile(lang);
    } catch (e) {
      console.warn("removeVoiceProfile failed", e);
    }
    if (lang === "default") {
      await supabase.from("profiles").update({ voice_clone_id: null }).eq("id", user.id);
    }
    await loadClones();
  };

  const langName = (code: string) => LANGUAGES.find((l) => l.code === code)?.native ?? (code === "default" ? t("voice.default") : code);
  const langEnName = (code: string) => LANGUAGES.find((l) => l.code === code)?.name ?? code;
  const langFlag = (code: string) => LANGUAGES.find((l) => l.code === code)?.flag ?? "🌍";
  const clonedLangs = clones.map((c) => c.lang);
  // Web parity: the recording UI only appears once a language is targeted
  // (chip tapped / Re-record pressed) or a sample exists.
  const showRecording = isRecording || !!recordedUri || !!uploadedMeta || targetLang !== null;

  return (
    <LinearGradient colors={[colors.bgTop, colors.bgMid, colors.bgBottom]} style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.iconBtnText}>←</Text>
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{t("voice.clone")}</Text>
            <Text style={styles.headerSub}>{t("voice.createClone")}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {!isPremium ? (
          <UpgradePrompt
            title={t("voice.premiumTitle")}
            description={t("voice.premiumDesc")}
          />
        ) : loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Voice profiles — one card per language (web parity) */}
            {clones.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>{t("voice.voiceProfiles")}</Text>
                {clones.map((c) => (
                  <View key={c.lang} style={[styles.profileCard, shadows.soft]}>
                    <View style={styles.profileTop}>
                      <View style={styles.flagAvatar}>
                        <Text style={styles.flagAvatarText}>{langFlag(c.lang)}</Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.profileName}>{langEnName(c.lang)}</Text>
                        <Text style={styles.profileStatus}>
                          {c.lang === language ? t("voice.default") : t("voice.ready")}
                        </Text>
                      </View>
                      <Ionicons name="checkmark-circle" size={22} color="#059669" />
                    </View>
                    <View style={styles.profileBtns}>
                      <Pressable
                        style={[styles.profileBtn, { flex: 1 }]}
                        onPress={() => { setTargetLang(c.lang); setRecordedUri(null); setUploadedMeta(null); setSampleDuration(null); }}
                      >
                        <Ionicons name="mic-outline" size={15} color={colors.primary} />
                        <Text style={styles.profileBtnText}>{t("voice.reRecord")}</Text>
                      </Pressable>
                      <Pressable style={[styles.profileBtn, styles.removeBtn]} onPress={() => removeClone(c.lang)}>
                        <Ionicons name="trash-outline" size={15} color="#dc2626" />
                        <Text style={[styles.profileBtnText, styles.removeBtnText]}>{t("voice.remove")}</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </>
            )}

            {/* Add a voice in another language (web parity) */}
            {!showRecording && (
              <View style={[styles.addCard, shadows.soft]}>
                <View style={styles.addTitleRow}>
                  <Ionicons name="language-outline" size={16} color={colors.primary} />
                  <Text style={styles.addTitle}>{t("voice.addAnother")}</Text>
                </View>
                <Text style={styles.addDesc}>
                  {clones.length === 0 ? t("voice.addAnotherDesc1") : t("voice.addAnotherDesc2")}
                </Text>
                <View style={styles.addChips}>
                  {LANGUAGES.filter((l) => !clonedLangs.includes(l.code)).map((l) => (
                    <Pressable
                      key={l.code}
                      style={styles.addChip}
                      onPress={() => { setTargetLang(l.code); setRecordedUri(null); setUploadedMeta(null); setSampleDuration(null); }}
                    >
                      <Text style={styles.addChipText}>{l.flag} {l.native}</Text>
                      <Ionicons name="add" size={14} color={colors.primary} />
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* First-time hero (no clones yet) — web parity */}
            {clones.length === 0 && !showRecording && (
              <View style={[styles.heroCard, shadows.soft]}>
                <View style={styles.heroCircle}>
                  <Text style={styles.heroMic}>🎤</Text>
                </View>
                <Text style={styles.heroTitle}>{t("voice.createClone")}</Text>
                <Text style={styles.heroDesc}>{t("voice.emptyDesc")}</Text>
                <View style={styles.tipsBox}>
                  <Text style={styles.tipsTitle}>{t("voice.tipsTitle")}</Text>
                  {[t("voice.tip1"), t("voice.tip2"), t("voice.tip3"), t("voice.tip4")].map((tip, i) => (
                    <Text key={i} style={styles.tip}>• {tip}</Text>
                  ))}
                </View>
              </View>
            )}

            {/* Recording control — shown once a language is targeted or a sample exists (web parity) */}
            {showRecording && (
            <View style={[styles.recordCard, shadows.card]}>
              {targetLang && !isRecording && (
                <View style={styles.recordInWrap}>
                  <View style={styles.recordInRow}>
                    <Text style={styles.recordInFlag}>{langFlag(targetLang)}</Text>
                    <Text style={styles.recordInText}>{t("voice.recordIn")} {langName(targetLang)}</Text>
                  </View>
                  <Text style={styles.recordHintText}>{t("voice.recordHint")}</Text>
                </View>
              )}
              {!isRecording ? (
                <>
                  <View style={styles.sourceRow}>
                    <Pressable style={[styles.recordBtn, { flex: 1 }]} onPress={startRecording}>
                      <View style={styles.recordCircle}>
                        <Text style={styles.recordIcon}>{recordedUri && !uploadedMeta ? "🔁" : "🎤"}</Text>
                      </View>
                      <Text style={styles.recordLabel}>
                        {recordedUri && !uploadedMeta ? t("voice.reRecord") : t("record.pressToRecord")}
                      </Text>
                    </Pressable>
                    <Pressable style={[styles.recordBtn, { flex: 1 }]} onPress={pickAudio}>
                      <View style={[styles.recordCircle, styles.uploadCircle]}>
                        <Text style={styles.recordIcon}>{uploadedMeta ? "🔁" : "📁"}</Text>
                      </View>
                      <Text style={styles.recordLabel}>
                        {uploadedMeta ? t("voice.chooseAnother") : t("voice.importAudio")}
                      </Text>
                    </Pressable>
                  </View>
                  {uploadedMeta && (
                    <Text style={styles.uploadedName} numberOfLines={1}>
                      📎 {uploadedMeta.name}
                    </Text>
                  )}
                </>
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
                  <Text style={styles.playBtnText}>{playing ? "⏸ " + t("voice.reRecord") : "▶️ " + t("voice.listenSample")}</Text>
                </Pressable>
              )}
            </View>
            )}

            {/* Create button */}
            {recordedUri && !isRecording && (
              <Pressable style={[styles.createBtn, shadows.soft, creating && { opacity: 0.6 }]} onPress={createClone} disabled={creating}>
                {creating ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.createBtnText}>
                    ✨ {t("voice.createClone")}{targetLang ? ` (${langName(targetLang)})` : ""}
                  </Text>
                )}
              </Pressable>
            )}

            {creating && (
              <Text style={styles.creatingHint}>
                {t("voice.creatingHint")}
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
  headerTitle: { fontSize: 18, color: colors.text, fontFamily: appFonts.displayBold },
  headerCenter: { flex: 1, alignItems: "center" },
  headerSub: { fontSize: 12, color: colors.textFaint, marginTop: 2, fontFamily: appFonts.body },
  sectionTitle: { fontSize: 15, color: colors.text, fontFamily: appFonts.bodySemiBold, marginBottom: 10 },
  profileCard: {
    ...glassCard,
    padding: 14,
    marginBottom: 10,
  },
  profileTop: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  flagAvatar: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: "rgba(29,129,237,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  flagAvatarText: { fontSize: 20 },
  profileName: { fontSize: 15, color: colors.text, fontFamily: appFonts.bodySemiBold },
  profileStatus: { fontSize: 12, color: colors.textFaint, marginTop: 2, fontFamily: appFonts.body },
  profileBtns: { flexDirection: "row", gap: 8 },
  profileBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: radius.input,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(29,129,237,0.35)",
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  profileBtnText: { fontSize: 13, color: colors.primary, fontFamily: appFonts.bodySemiBold },
  removeBtn: { borderColor: "rgba(220,38,38,0.35)" },
  removeBtnText: { color: "#dc2626" },
  addCard: {
    ...glassCard,
    padding: 16,
    marginBottom: 16,
  },
  addTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  addTitle: { fontSize: 14, color: colors.text, fontFamily: appFonts.bodySemiBold },
  addDesc: { fontSize: 12, color: colors.textMuted, marginBottom: 10, lineHeight: 18, fontFamily: appFonts.body },
  addChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  addChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.6)",
    borderWidth: 1,
    borderColor: "rgba(29,129,237,0.2)",
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  addChipText: { fontSize: 13, color: colors.text, fontFamily: appFonts.bodyMedium },
  heroCard: {
    ...glassCard,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
  },
  heroCircle: {
    width: 68,
    height: 68,
    borderRadius: 999,
    backgroundColor: "#fef3c7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  heroMic: { fontSize: 32 },
  heroTitle: { fontSize: 18, color: colors.text, fontFamily: appFonts.displayBold, textAlign: "center", marginBottom: 6 },
  heroDesc: { fontSize: 13, color: colors.textMuted, textAlign: "center", lineHeight: 19, fontFamily: appFonts.body },
  tipsBox: {
    alignSelf: "stretch",
    backgroundColor: "rgba(148,163,184,0.10)",
    borderRadius: 12,
    padding: 14,
    marginTop: 14,
  },
  tipsTitle: { fontSize: 13, color: colors.text, fontFamily: appFonts.bodySemiBold, marginBottom: 6 },
  tip: { fontSize: 12, color: colors.textMuted, lineHeight: 19, fontFamily: appFonts.body },
  recordInWrap: { marginBottom: 14 },
  recordInRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  recordInFlag: { fontSize: 18 },
  recordInText: { fontSize: 14, color: colors.text, fontFamily: appFonts.bodySemiBold },
  recordHintText: { fontSize: 12, color: colors.textFaint, marginTop: 3, fontFamily: appFonts.body },
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
  defaultBadge: {
    backgroundColor: "#e0f2fe",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  defaultBadgeText: { fontSize: 10, color: "#1d81ed", fontWeight: "700" },
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
  recordBtn: { alignItems: "center" },
  sourceRow: { flexDirection: "row", gap: 12 },
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
  uploadCircle: { backgroundColor: "#e8f5e9", borderColor: "rgba(16,185,129,0.3)" },
  recordIcon: { fontSize: 36 },
  recordLabel: { fontSize: 15, color: colors.text, fontFamily: appFonts.bodySemiBold, textAlign: "center" },
  uploadedName: {
    marginTop: 10,
    fontSize: 12,
    color: "#059669",
    textAlign: "center",
    fontFamily: appFonts.bodyMedium,
  },
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
