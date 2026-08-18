import { useCallback, useEffect, useState, useMemo } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { colors, radius, fonts, glassCard, shadows } from "@/theme";
import { useAppFonts, type AppFonts } from "@/hooks/useAppFonts";
import { supabase } from "@/lib/supabase";
import { resolveAvatarUrl } from "@/lib/avatar";
import { useAuthStore } from "@/store/authStore";
import { useT } from "@/store/settingsStore";

export default function ProfileSettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const appFonts = useAppFonts();
  const styles = useMemo(() => makeStyles(appFonts), [appFonts]);
  const user = useAuthStore((s) => s.user);
  const t = useT();
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [gender, setGender] = useState<string | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("display_name, avatar_url, gender, interests")
      .eq("id", user.id)
      .maybeSingle();
    if (data?.display_name) setDisplayName(data.display_name);
    if (data?.avatar_url) {
      // Stored URL may be a broken single-nested path — resolve the real one
      resolveAvatarUrl(data.avatar_url).then(setAvatarUrl);
    }
    if ((data as any)?.gender) setGender((data as any).gender);
    if (Array.isArray((data as any)?.interests)) setInterests((data as any).interests);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const initials = (displayName || user?.email || "SJ")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const pickAvatar = async () => {
    if (!user) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Photos", "Autorisez l'accès aux photos pour choisir un avatar.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;

    setUploading(true);
    try {
      const uri = result.assets[0].uri;
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const ext = uri.split(".").pop()?.toLowerCase() || "jpg";
      // Upload into the user's folder (nested path that the storage server serves)
      const fileName = `${user.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, decodeBase64(base64), {
          contentType: ext === "png" ? "image/png" : "image/jpeg",
          upsert: true,
        });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(fileName);
      // getPublicUrl yields the single-nested path which the server rejects —
      // resolve the working (double-nested) URL and store THAT.
      const resolved = await resolveAvatarUrl(publicUrl);
      const urlWithCacheBuster = `${resolved ?? publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: urlWithCacheBuster })
        .eq("id", user.id);
      if (updateError) throw updateError;

      setAvatarUrl(urlWithCacheBuster);
      Alert.alert("✓", "Photo de profil mise à jour.");
    } catch (e) {
      console.warn("avatar error", e);
      Alert.alert("Erreur", "Impossible de téléverser la photo.");
    } finally {
      setUploading(false);
    }
  };

  const saveName = async () => {
    if (!user) return;
    const name = displayName.trim();
    if (!name) {
      Alert.alert("Nom", "Le nom ne peut pas être vide.");
      return;
    }
    setSaving(true);
    try {
      const patch: any = { display_name: name };
      if (gender) patch.gender = gender;
      if (interests.length > 0) patch.interests = interests;
      const { error } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", user.id);
      if (error) throw error;
      Alert.alert("✓", "Profil mis à jour.");
      navigation.goBack();
    } catch (e) {
      console.warn("name error", e);
      Alert.alert("Erreur", "Impossible d'enregistrer.");
    } finally {
      setSaving(false);
    }
  };

  const GENDERS = ["Femme", "Homme", "Non-binaire", "Autre"];

  return (
    <LinearGradient colors={[colors.bgTop, colors.bgMid, colors.bgBottom]} style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.iconBtnText}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>👤 Profil</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Avatar */}
        <View style={[styles.avatarCard, shadows.card]}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          <Pressable style={[styles.avatarBtn, shadows.soft]} onPress={pickAvatar} disabled={uploading}>
            {uploading ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Text style={styles.avatarBtnText}>📷 Changer la photo</Text>
            )}
          </Pressable>
        </View>

        {/* Display name */}
        <View style={[styles.card, shadows.card]}>
          <Text style={styles.label}>Nom affiché</Text>
          <TextInput
            style={[styles.input, shadows.soft]}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Votre nom"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="words"
          />

          {/* Gender */}
          <Text style={styles.label}>Genre</Text>
          <View style={styles.chipRow}>
            {GENDERS.map((g) => {
              const active = gender === g;
              return (
                <Pressable
                  key={g}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setGender(active ? null : g)}
                >
                  <Text style={[styles.chipText, active && { color: colors.white }]}>{g}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Interests */}
          <Text style={styles.label}>Intérêts (espaces séparés)</Text>
          <TextInput
            style={[styles.input, shadows.soft]}
            value={interests.join(" ")}
            onChangeText={(v) => setInterests(v.split(/\s+/).filter(Boolean))}
            placeholder="lecture, nature, sport…"
            placeholderTextColor={colors.textFaint}
          />

          <Pressable style={[styles.saveBtn, shadows.soft, saving && { opacity: 0.6 }]} onPress={saveName} disabled={saving}>
            <Text style={styles.saveBtnText}>{saving ? "Enregistrement…" : "Enregistrer"}</Text>
          </Pressable>
        </View>

        <Text style={styles.footnote}>{user?.email}</Text>
      </ScrollView>
    </LinearGradient>
  );
}

/** base64 string -> Uint8Array (for storage upload) */
function decodeBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const makeStyles = (appFonts: AppFonts) => StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 999,
    backgroundColor: colors.cardGlassStrong, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.glassBorder,
  },
  iconBtnText: { fontSize: 20, color: colors.primary, fontFamily: appFonts.bodyBold },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 18, color: colors.text, fontFamily: appFonts.displayBold },
  avatarCard: { ...glassCard, padding: 24, alignItems: "center", marginBottom: 16 },
  avatarImage: { width: 96, height: 96, borderRadius: 999, borderWidth: 2, borderColor: "rgba(255,255,255,0.8)" },
  avatarFallback: {
    width: 96, height: 96, borderRadius: 999,
    backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "rgba(255,255,255,0.8)",
  },
  avatarText: { color: colors.white, fontSize: 32, fontWeight: "700", fontFamily: appFonts.bodyBold },
  avatarBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginTop: 14,
  },
  avatarBtnText: { color: colors.white, fontSize: 13, fontWeight: "700", fontFamily: appFonts.bodySemiBold },
  card: { ...glassCard, padding: 18, marginBottom: 16 },
  label: { fontSize: 13, color: colors.textMuted, fontFamily: appFonts.bodySemiBold, marginBottom: 8 },
  input: {
    backgroundColor: colors.white,
    borderRadius: radius.input,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    fontFamily: appFonts.body,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  chip: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(29,129,237,0.2)",
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.primary, fontFamily: appFonts.bodySemiBold },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.input,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 14,
  },
  saveBtnText: { color: colors.white, fontSize: 15, fontWeight: "700", fontFamily: appFonts.bodyBold },
  footnote: { fontSize: 12, color: colors.textFaint, textAlign: "center", fontFamily: appFonts.body },
});
