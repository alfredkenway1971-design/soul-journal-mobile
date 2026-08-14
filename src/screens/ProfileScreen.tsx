import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Alert } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, radius } from "@/theme";
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

  return (
    <LinearGradient colors={[colors.bgTop, colors.bgBottom]} style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>👤 Profil</Text>

        <View style={styles.card}>
          <Text style={styles.name}>{displayName || "Soul Journal"}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        {/* Phase 2: Goals, Relations, Voice, AI features, Manage subscription */}
        <Pressable style={styles.row} onPress={() => Alert.alert("Bientôt", "Objectifs & IA — Phase 2.")}>
          <Text style={styles.rowEmoji}>🎯</Text>
          <Text style={styles.rowLabel}>Objectifs</Text>
          <Text style={styles.rowArrow}>→</Text>
        </Pressable>
        <Pressable style={styles.row} onPress={() => Alert.alert("Bientôt", "Voix clonée — Phase 2.")}>
          <Text style={styles.rowEmoji}>🎙️</Text>
          <Text style={styles.rowLabel}>Ma voix</Text>
          <Text style={styles.rowArrow}>→</Text>
        </Pressable>
        <Pressable style={styles.row} onPress={() => Alert.alert("Bientôt", "Abonnement — Phase 3 (Google Play).")}>
          <Text style={styles.rowEmoji}>👑</Text>
          <Text style={styles.rowLabel}>Premium & abonnement</Text>
          <Text style={styles.rowArrow}>→</Text>
        </Pressable>
        <Pressable style={styles.row} onPress={() => Alert.alert("Soul Journal", "Version 0.1.0 (Phase 1 — Android).")}>
          <Text style={styles.rowEmoji}>ℹ️</Text>
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
  content: { padding: 20, paddingBottom: 100 },
  title: { fontSize: 26, fontWeight: "700", color: colors.text, marginBottom: 16 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    alignItems: "center",
  },
  name: { fontSize: 20, fontWeight: "700", color: colors.text },
  email: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  rowEmoji: { fontSize: 20, marginRight: 12 },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.text },
  rowArrow: { fontSize: 16, color: colors.textFaint },
  signOut: { marginTop: 24, alignItems: "center", paddingVertical: 14 },
  signOutText: { color: colors.danger, fontSize: 15, fontWeight: "600" },
});
