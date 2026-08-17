import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Alert, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { colors, radius, fonts, glassCard, shadows } from "@/theme";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { useT } from "@/store/settingsStore";

interface AdminUser {
  id: string;
  email: string;
  display_name?: string | null;
  is_manual_grant?: boolean;
  is_admin?: boolean;
}

export default function AdminScreen() {
  const navigation = useNavigation();
  const user = useAuthStore((s) => s.user);
  const t = useT();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const uid = sessionData.session?.user?.id;
    if (!token || !uid) { setLoading(false); return; }
    try {
      // Admin check: user_roles row with role='admin' (same as web)
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid)
        .eq("role", "admin");
      if (roles?.length) setIsAdmin(true);
      else { setLoading(false); return; }

      const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/admin-users?action=list-users`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (Array.isArray(json)) setUsers(json);
      else if (Array.isArray(json?.users)) setUsers(json.users);
    } catch (e) {
      console.warn("admin list error", e);
      Alert.alert("Admin", "Impossible de charger les utilisateurs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleAccess = async (u: AdminUser) => {
    const action = u.is_manual_grant ? "revoke-access" : "grant-access";
    setBusyId(u.id);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/admin-users?action=${action}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ user_id: u.id }),
      });
      if (!res.ok) throw new Error(`admin ${res.status}`);
      await load();
    } catch (e) {
      console.warn("toggle error", e);
      Alert.alert("Admin", "Action impossible.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <LinearGradient colors={[colors.bgTop, colors.bgMid, colors.bgBottom]} style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.iconBtnText}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>🛡️ Admin</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={[styles.banner, shadows.soft]}>
          <Text style={styles.bannerText}>
            {isAdmin
              ? "Gestion des accès Premium — réservez aux comptes administrateurs."
              : "Accès réservé aux administrateurs."}
          </Text>
        </View>

        {!isAdmin ? (
          <View style={[styles.deniedCard, shadows.soft]}>
            <Text style={styles.deniedEmoji}>🔒</Text>
            <Text style={styles.deniedText}>Vous n'avez pas les droits administrateur.</Text>
          </View>
        ) : loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : users.length === 0 ? (
          <Text style={styles.empty}>Aucun utilisateur.</Text>
        ) : (
          users.map((u) => (
            <View key={u.id} style={[styles.row, shadows.soft]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowEmail}>{u.email}</Text>
                <View style={styles.badges}>
                  {u.is_admin && <View style={styles.badge}><Text style={styles.badgeText}>Admin</Text></View>}
                  {u.is_manual_grant && <View style={[styles.badge, styles.badgePremium]}><Text style={[styles.badgeText, { color: "#b45309" }]}>Premium</Text></View>}
                </View>
              </View>
              {u.is_admin ? (
                <Text style={styles.inherent}>—</Text>
              ) : (
                <Pressable
                  style={[styles.toggleBtn, u.is_manual_grant && styles.toggleBtnOff, busyId === u.id && { opacity: 0.5 }]}
                  onPress={() => toggleAccess(u)}
                  disabled={busyId != null}
                >
                  {busyId === u.id ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <Text style={styles.toggleText}>
                      {u.is_manual_grant ? "Révoquer" : "Accorder"}
                    </Text>
                  )}
                </Pressable>
              )}
            </View>
          ))
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
  banner: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.card,
    padding: 14,
    marginBottom: 16,
  },
  bannerText: { fontSize: 13, color: colors.text, fontFamily: fonts.body, lineHeight: 19 },
  empty: { color: colors.textMuted, fontSize: 14, textAlign: "center", marginTop: 40, fontFamily: fonts.body },
  deniedCard: {
    ...glassCard,
    padding: 28,
    alignItems: "center",
  },
  deniedEmoji: { fontSize: 36, marginBottom: 8 },
  deniedText: { fontSize: 14, color: colors.textMuted, textAlign: "center", fontFamily: fonts.body },
  row: {
    ...glassCard,
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    marginBottom: 10,
  },
  rowEmail: { fontSize: 14, color: colors.text, fontFamily: fonts.bodySemiBold },
  badges: { flexDirection: "row", gap: 6, marginTop: 6 },
  badge: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgePremium: { backgroundColor: "#fef3c7" },
  badgeText: { fontSize: 10, color: colors.primary, fontFamily: fonts.bodySemiBold },
  inherent: { color: colors.textFaint, fontSize: 14, fontFamily: fonts.body },
  toggleBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  toggleBtnOff: { backgroundColor: colors.danger },
  toggleText: { color: colors.white, fontSize: 12, fontWeight: "700", fontFamily: fonts.bodySemiBold },
});
