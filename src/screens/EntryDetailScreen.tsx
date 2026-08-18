import { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, Pressable, StyleSheet, ScrollView, Alert, ActivityIndicator, TextInput,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { colors, radius, fonts, glassCard, shadows } from "@/theme";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { useT } from "@/store/settingsStore";

const ENHANCE_URL = "https://soul-journal-seven.vercel.app/api/enhance-text";

const MOOD_EMOJI: Record<string, string> = {
  happy: "😊",
  good: "😇",
  fine: "😌",
  sad: "😔",
  unhappy: "😢",
};

const GENERATE_VOICE_URL = "https://soul-journal-seven.vercel.app/api/generate-voice";

interface EntryDetail {
  id: string;
  title: string | null;
  mood: string | null;
  created_at: string;
  enhanced_text: string | null;
  original_transcription: string | null;
  detected_language: string | null;
  playback_language: string | null;
}

type RootStackParamList = {
  EntryDetail: { id: string };
};
type EntryDetailRoute = RouteProp<RootStackParamList, "EntryDetail">;

const fmtDate = (iso: string) => {
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString("fr-CA", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    })} · ${d.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}`;
  } catch {
    return iso;
  }
};

export default function EntryDetailScreen() {
  const route = useRoute<EntryDetailRoute>();
  const navigation = useNavigation();
  const user = useAuthStore((s) => s.user);
  const t = useT();
  const [entry, setEntry] = useState<EntryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [enhancing, setEnhancing] = useState(false);
  const playerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);

  useEffect(() => {
    setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("journal_entries")
      .select(
        "id, title, mood, created_at, enhanced_text, original_transcription, detected_language, playback_language"
      )
      .eq("id", route.params.id)
      .maybeSingle();
    setEntry(data ?? null);
    setLoading(false);
  }, [user, route.params.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    return () => {
      playerRef.current?.remove();
    };
  }, []);

  const stopPlayback = async () => {
    const p = playerRef.current;
    playerRef.current = null;
    if (p) {
      try {
        p.pause();
        p.remove();
      } catch {}
    }
    setPlaying(false);
  };

  const playEntry = async () => {
    if (!entry) return;
    if (playing) {
      await stopPlayback();
      return;
    }
    const text = entry.enhanced_text || entry.original_transcription || "";
    if (!text.trim()) return;

    // Cached audio dir — repeat plays are instant, no re-synthesis
    const audioDir = `${FileSystem.documentDirectory}voice-cache/`;
    const fileUri = `${audioDir}voice-${entry.id}.mp3`;

    const playFromFile = async (uri: string) => {
      const player = createAudioPlayer({ uri });
      playerRef.current = player;
      setGenerating(false);
      setPlaying(true);
      player.addListener("playbackStatusUpdate", (status) => {
        if (status.playbackState === "ended") {
          setPlaying(false);
          player.remove();
          playerRef.current = null;
        }
      });
      player.play();
    };

    // 1) Try the local cache first (instant)
    try {
      const info = await FileSystem.getInfoAsync(fileUri);
      if (info.exists) {
        await playFromFile(fileUri);
        return;
      }
    } catch {}

    setGenerating(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("no session");

      // Voice routing (same as web): entry language → any available → default
      let voiceId: string | null = null;
      const entryLang = (entry as any)?.detected_language || (entry as any)?.playback_language || null;
      const { data: voices } = await supabase
        .from("voice_profiles")
        .select("lang, voice_id")
        .eq("user_id", user!.id);
      if (voices && voices.length > 0) {
        const byLang = voices.find((v) => v.lang === entryLang);
        voiceId = byLang?.voice_id ?? voices[0].voice_id;
      }
      if (!voiceId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("voice_clone_id")
          .eq("id", user!.id)
          .maybeSingle();
        if (profile?.voice_clone_id) voiceId = profile.voice_clone_id;
      }

      const res = await fetch(GENERATE_VOICE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text,
          voiceId: voiceId ?? "default",
          language: entry.playback_language || entry.detected_language || undefined,
        }),
      });
      if (!res.ok) throw new Error(`voice ${res.status}`);
      const json = await res.json();
      if (!json?.audioContent) throw new Error("no audio");

      // 2) Save to the persistent cache, then play
      await FileSystem.makeDirectoryAsync(audioDir, { intermediates: true }).catch(() => {});
      await FileSystem.writeAsStringAsync(fileUri, json.audioContent, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await playFromFile(fileUri);
    } catch (e) {
      console.warn("play error", e);
      setGenerating(false);
      Alert.alert("Playback", t("entry.playFailed"));
    }
  };

  const confirmDelete = () => {
    if (!entry) return;
    Alert.alert(t("entry.delete"), t("entry.deleteConfirm"), [
      { text: t("profile.cancel"), style: "cancel" },
      {
        text: t("entry.deleteBtn"),
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("journal_entries").delete().eq("id", entry.id);
          if (error) {
            Alert.alert("Error", t("entry.deleteError"));
            return;
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          navigation.goBack();
        },
      },
    ]);
  };

  const body = entry?.enhanced_text || entry?.original_transcription || "";

  const startEdit = () => {
    setEditText(body);
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!entry) return;
    const next = editText.trim();
    if (!next) {
      Alert.alert("Empty entry", t("record.empty"));
      return;
    }
    try {
      const { error } = await supabase
        .from("journal_entries")
        .update({ enhanced_text: next })
        .eq("id", entry.id);
      if (error) throw error;
      setEntry({ ...entry, enhanced_text: next });
      setEditing(false);
      // Edited text invalidates the cached voice
      try {
        const dir = `${FileSystem.documentDirectory}voice-cache/`;
        const info = await FileSystem.getInfoAsync(`${dir}voice-${entry.id}.mp3`);
        if (info.exists) await FileSystem.deleteAsync(`${dir}voice-${entry.id}.mp3`);
      } catch {}
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("✓", t("entry.bodyUpdated"));
    } catch (e) {
      console.warn("save edit error", e);
      Alert.alert("Error", t("entry.bodyFailed"));
    }
  };

  const enhanceBody = async (tone: "natural" | "structured") => {
    if (!entry) return;
    const source = editText || body;
    if (!source.trim()) return;
    setEnhancing(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("no session");

      const res = await fetch(ENHANCE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: source,
          tone,
          language: (entry as any)?.detected_language || undefined,
        }),
      });
      if (!res.ok) throw new Error(`enhance ${res.status}`);
      const json = await res.json();
      if (!json?.enhancedText) throw new Error("no result");

      // Apply the result to the editor AND persist (mirrors web behavior)
      setEditText(json.enhancedText);
      const { error } = await supabase
        .from("journal_entries")
        .update({ enhanced_text: json.enhancedText })
        .eq("id", entry.id);
      if (error) throw error;
      setEntry({ ...entry, enhanced_text: json.enhancedText });
      // Invalidate cached voice
      try {
        const dir = `${FileSystem.documentDirectory}voice-cache/`;
        const info = await FileSystem.getInfoAsync(`${dir}voice-${entry.id}.mp3`);
        if (info.exists) await FileSystem.deleteAsync(`${dir}voice-${entry.id}.mp3`);
      } catch {}
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("✨", t("entry.enhanced"));
    } catch (e) {
      console.warn("enhance error", e);
      Alert.alert("Error", t("entry.enhanceFailed"));
    } finally {
      setEnhancing(false);
    }
  };

  return (
    <LinearGradient colors={[colors.bgTop, colors.bgMid, colors.bgBottom]} style={styles.root}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : !entry ? (
        <View style={styles.center}>
          <Text style={styles.missing}>{t("entry.notFound")}</Text>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>{t("entry.back")}</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.headerRow}>
            <Pressable style={styles.iconBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.iconBtnText}>←</Text>
            </Pressable>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {entry.title || t("entry.untitled")}
            </Text>
            <Pressable style={styles.iconBtn} onPress={confirmDelete}>
              <Text style={styles.iconBtnTextDanger}>🗑️</Text>
            </Pressable>
          </View>

          {/* Meta card */}
          <View style={[styles.metaCard, shadows.soft]}>
            <Text style={styles.metaDate}>{fmtDate(entry.created_at)}</Text>
            <Text style={styles.metaMood}>
              {MOOD_EMOJI[entry.mood ?? ""] ?? "📝"}{" "}
              {entry.mood ? entry.mood.charAt(0).toUpperCase() + entry.mood.slice(1) : ""}
            </Text>
          </View>

          {/* Play card */}
          <Pressable
            style={[styles.playCard, shadows.card, (generating || playing) && { borderColor: colors.primary }]}
            onPress={playEntry}
            disabled={generating}
          >
            {generating ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <View style={[styles.playCircle, playing && { backgroundColor: colors.primaryLight }]}>
                <Text style={styles.playIcon}>{playing ? "⏸" : "▶️"}</Text>
              </View>
            )}
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={styles.playTitle}>
                {generating ? t("entry.generating") : playing ? t("entry.listening") : t("entry.listen")}
              </Text>
              <Text style={styles.playDesc}>
                {generating ? t("entry.generatingDesc") : t("entry.aiVoice")}
              </Text>
            </View>
          </Pressable>

          {/* Body — editable + AI enhance (matches web "Your Story" card) */}
          <View style={[styles.bodyCard, shadows.card]}>
            <View style={styles.bodyHeader}>
              <Text style={styles.bodyHeaderTitle}>Votre histoire</Text>
              {!editing && (
                <Pressable onPress={startEdit} hitSlop={8}>
                  <Text style={styles.editBtn}>✏️ Modifier</Text>
                </Pressable>
              )}
            </View>

            {editing ? (
              <TextInput
                style={styles.editInput}
                value={editText}
                onChangeText={setEditText}
                multiline
                textAlignVertical="top"
                placeholder={t("entry.noContent")}
                placeholderTextColor={colors.textFaint}
              />
            ) : (
              <Text style={styles.bodyText}>{body || t("entry.noContent")}</Text>
            )}

            {/* Action row */}
            {!editing && (
              <View style={styles.actionsRow}>
                <Pressable style={styles.actionBtn} onPress={startEdit}>
                  <Text style={styles.actionBtnText}>✏️ {t("entry.editBtn")}</Text>
                </Pressable>
                <Pressable style={styles.actionBtn} onPress={() => enhanceBody("natural")} disabled={enhancing}>
                  <Text style={styles.actionBtnText}>
                    {enhancing ? t("record.enhancing") : `✨ ${t("entry.enhanceBtn")}`}
                  </Text>
                </Pressable>
                <Pressable style={styles.actionBtn} onPress={() => enhanceBody("structured")} disabled={enhancing}>
                  <Text style={styles.actionBtnText}>📑 {t("entry.enhanceStructured")}</Text>
                </Pressable>
              </View>
            )}

            {editing && (
              <View style={styles.actionsRow}>
                <Pressable style={[styles.actionBtn, styles.actionPrimary]} onPress={saveEdit} disabled={enhancing}>
                  <Text style={styles.actionPrimaryText}>✓ {t("entry.saveBtn")}</Text>
                </Pressable>
                <Pressable style={styles.actionBtn} onPress={() => enhanceBody("natural")} disabled={enhancing}>
                  <Text style={styles.actionBtnText}>
                    {enhancing ? t("record.enhancing") : `✨ ${t("entry.enhanceBtn")}`}
                  </Text>
                </Pressable>
                <Pressable style={styles.actionBtn} onPress={() => enhanceBody("structured")} disabled={enhancing}>
                  <Text style={styles.actionBtnText}>📑 {t("entry.enhanceStructured")}</Text>
                </Pressable>
                <Pressable style={styles.actionBtn} onPress={() => setEditing(false)}>
                  <Text style={styles.actionCancelText}>✕</Text>
                </Pressable>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  missing: { color: colors.textMuted, fontSize: 15, fontFamily: fonts.body },
  backBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.input,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  backBtnText: { color: colors.white, fontFamily: fonts.bodySemiBold },
  content: { padding: 20, paddingBottom: 60 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
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
  iconBtnTextDanger: { fontSize: 18 },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    color: colors.text,
    fontFamily: fonts.displayBold,
    paddingHorizontal: 8,
  },
  metaCard: {
    ...glassCard,
    padding: 16,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  metaDate: { fontSize: 13, color: colors.textMuted, fontFamily: fonts.bodyMedium, flex: 1 },
  metaMood: { fontSize: 13, color: colors.text, fontFamily: fonts.bodySemiBold },
  playCard: {
    ...glassCard,
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    marginBottom: 14,
  },
  playCircle: {
    width: 54,
    height: 54,
    borderRadius: 999,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  playIcon: { fontSize: 22 },
  playTitle: { fontSize: 15, color: colors.text, fontFamily: fonts.bodySemiBold },
  playDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2, fontFamily: fonts.body },
  bodyCard: {
    ...glassCard,
    padding: 20,
  },
  bodyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  bodyHeaderTitle: {
    fontSize: 15,
    color: colors.text,
    fontFamily: fonts.display,
  },
  editBtn: { fontSize: 13, color: colors.primary, fontFamily: fonts.bodySemiBold },
  editInput: {
    backgroundColor: colors.white,
    borderRadius: radius.input,
    padding: 14,
    minHeight: 160,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    fontFamily: fonts.body,
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  actionBtn: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(29,129,237,0.2)",
  },
  actionPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  actionBtnText: { fontSize: 12, color: colors.primary, fontFamily: fonts.bodySemiBold },
  actionPrimaryText: { fontSize: 12, color: colors.white, fontFamily: fonts.bodyBold },
  actionCancelText: { fontSize: 14, color: colors.textFaint, fontFamily: fonts.bodyBold },
  bodyText: {
    fontSize: 16,
    lineHeight: 25,
    color: colors.text,
    fontFamily: fonts.body,
  },
});
