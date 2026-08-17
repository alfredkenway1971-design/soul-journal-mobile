import { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, Pressable, StyleSheet, ScrollView, Alert, ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { colors, radius, fonts, glassCard, shadows } from "@/theme";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { useT } from "@/store/settingsStore";

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
    return d.toLocaleDateString("fr-CA", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
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
  const soundRef = useRef<Audio.Sound | null>(null);

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
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const stopPlayback = async () => {
    const s = soundRef.current;
    soundRef.current = null;
    if (s) {
      try {
        await s.stopAsync();
        await s.unloadAsync();
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

    setGenerating(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("no session");

      const res = await fetch(GENERATE_VOICE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text,
          voiceId: "default",
          language: entry.playback_language || entry.detected_language || undefined,
        }),
      });
      if (!res.ok) throw new Error(`voice ${res.status}`);
      const json = await res.json();
      if (!json?.audioContent) throw new Error("no audio");

      // base64 -> file -> play (expo-av cannot stream from base64 directly)
      const fileUri = `${FileSystem.cacheDirectory}voice-${entry.id}.mp3`;
      await FileSystem.writeAsStringAsync(fileUri, json.audioContent, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: fileUri },
        { shouldPlay: true }
      );
      soundRef.current = sound;
      setGenerating(false);
      setPlaying(true);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlaying(false);
          sound.unloadAsync().catch(() => {});
          soundRef.current = null;
        }
      });
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

          {/* Body */}
          <View style={[styles.bodyCard, shadows.card]}>
            <Text style={styles.bodyText}>{body || t("entry.noContent")}</Text>
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
  bodyText: {
    fontSize: 16,
    lineHeight: 25,
    color: colors.text,
    fontFamily: fonts.body,
  },
});
