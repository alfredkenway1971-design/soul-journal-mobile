import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Alert } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, fonts, glassCard, shadows } from "@/theme";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";

export default function ProfileScreen() {
  const { user, signOut } = useAuthStore();
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.display_name) setDisplayName(data.display_name);
      });
  }, [user]);

  const doSignOut = () => {
    Alert.alert("Déconnexion", "Voulez-vous vraiment vous déconnecter ?", [
      { text: "Annuler", style: "cancel" },
      { text: "Déconnecter", style: "destructive", onPress: () => signOut() },
    ]);
  };

  const initials = (displayName || user?.email || "SJ")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <LinearGradient colors={[colors.bgTop, colors.bgMid, colors.bgBottom]} style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>👤 Profil</Text>

        <View style={[styles.card, shadows.card]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.name}>{displayName || "Soul Journal"}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        {/* Phase 2: Goals, Relations, Voice, AI features, Manage subscription */}
        <Pressable style={[styles.row, shadows.soft]} onPress={() => Alert.alert("Bientôt", "Objectifs & IA — Phase 2.")}>
          <View style={styles.rowIcon}>
            <Text style={styles.rowEmoji}>🎯</Text>
          </View>
          <Text style={styles.rowLabel}>Objectifs</Text>
          <Text style={styles.rowArrow}>→</Text>
        </Pressable>
        <Pressable style={[styles.row, shadows.soft]} onPress={() => Alert.alert("Bientôt", "Voix clonée — Phase 2.")}>
          <View style={styles.rowIcon}>
            <Text style={styles.rowEmoji}>🎙️</Text>
          </View>
          <Text style={styles.rowLabel}>Ma voix</Text>
          <Text style={styles.rowArrow}>→</Text>
        </Pressable>
        <Pressable style={[styles.row, shadows.soft]} onPress={() => Alert.alert("Bientôt", "Abonnement — Phase 3 (Google Play).")}>
          <View style={styles.rowIcon}>
            <Text style={styles.rowEmoji}>👑</Text>
          </View>
          <Text style={styles.rowLabel}>Premium & abonnement</Text>
          <Text style={styles.rowArrow}>→</Text>
        </Pressable>
        <Pressable style={[styles.row, shadows.soft]} onPress={() => Alert.alert("Soul Journal", "Version 0.1.0 (Phase 1 — Android).")}>
          <View style={styles.rowIcon}>
            <Text style={styles.rowEmoji}>ℹ️</Text>
          </View>
          <Text style={styles.rowLabel}>À propos</Text>
          <Text style={styles.rowArrow}>→</Text>
        </Pressable>

        <Pressable style={styles.signOut} onPress={doSignOut}>
          <Text style={styles.signOutText}>Se déconnecter</Text>
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
    marginBottom: 16,
  },
  card: {
    ...glassCard,
    padding: 24,
    marginBottom: 16,
    alignItems: "center",
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.7)",
  },
  avatarText: { color: colors.white, fontSize: 22, fontWeight: "700", fontFamily: fonts.bodyBold },
  name: { fontSize: 20, color: colors.text, fontFamily: fonts.displayBold },
  email: { fontSize: 13, color: colors.textMuted, marginTop: 4, fontFamily: fonts.body },
  row: {
    flexDirection: "row",
    alignItems: "center",
    ...glassCard,
    padding: 16,
    marginBottom: 10,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  rowEmoji: { fontSize: 17 },
  rowLabel: { flex: 1, fontSize: 15, color: colors.text, fontFamily: fonts.bodySemiBold },
  rowArrow: { fontSize: 16, color: colors.textFaint },
  signOut: { marginTop: 24, alignItems: "center", paddingVertical: 14 },
  signOutText: { color: colors.danger, fontSize: 15, fontWeight: "600", fontFamily: fonts.bodySemiBold },
});
