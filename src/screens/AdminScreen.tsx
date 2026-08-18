import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Alert, ActivityIndicator, TextInput } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { colors, radius, fonts, glassCard, shadows } from "@/theme";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { useT } from "@/store/settingsStore";

interface AdminUser {
  id: string;
  email: string | null;
  display_name?: string | null;
  created_at?: string;
  last_sign_in_at?: string | null;
  subscription?: {
    status?: string;
    plan_type?: string;
    is_manual_grant?: boolean;
  } | null;
}

type Tab = "users" | "revenue" | "grants";

const fmtShort = (iso?: string | null) => {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" });
  } catch { return null; }
};

export default function AdminScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const user = useAuthStore((s) => s.user);
  const t = useT();
  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const uid = sessionData.session?.user?.id;
    if (!token || !uid) { setLoading(false); return; }
    try {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid)
        .eq("role", "admin");
      if (!roles?.length) { setIsAdmin(false); setLoading(false); return; }
      setIsAdmin(true);

      const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/admin-users?action=list-users`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      const list = Array.isArray(json) ? json : Array.isArray(json?.users) ? json.users : [];
      setUsers(list as AdminUser[]);
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
    const action = u.subscription?.is_manual_grant ? "revoke-access" : "grant-access";
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.email?.toLowerCase().includes(q) ||
        u.display_name?.toLowerCase().includes(q)
    );
  }, [users, search]);

  // Revenue metrics (same derivation as web: monthly $5.99/mo, annual $49.99/yr)
  const active = users.filter((u) => u.subscription?.status === "active");
  const monthly = active.filter((u) => u.subscription?.plan_type === "monthly");
  const annual = active.filter((u) => u.subscription?.plan_type === "annual");
  const grants = users.filter((u) => u.subscription?.is_manual_grant);
  const monthlyRevenue = monthly.length * 599;
  const annualShare = Math.round((annual.length * 4999) / 12);
  const totalMonthly = monthlyRevenue + annualShare;
  const fmtUSD = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

  const statusBadge = (u: AdminUser) => {
    const s = u.subscription;
    if (!s) return { label: "Gratuit", bg: colors.primaryLight, fg: colors.primary };
    if (s.is_manual_grant) return { label: "Accès manuel", bg: "#f3e8ff", fg: "#7c3aed" };
    if (s.status === "active") return { label: "Actif", bg: "#d1fae5", fg: "#047857" };
    if (s.status === "cancelled") return { label: "Annulé", bg: "#ffedd5", fg: "#c2410c" };
    return { label: "Inactif", bg: colors.primaryLight, fg: colors.primary };
  };

  const initials = (u: AdminUser) =>
    (u.display_name?.[0] || u.email?.[0] || "?").toUpperCase();

  const TabBtn = ({ k, label }: { k: Tab; label: string }) => (
    <Pressable
      style={[styles.tabBtn, tab === k && styles.tabBtnActive]}
      onPress={() => setTab(k)}
    >
      <Text style={[styles.tabText, tab === k && { color: colors.primary }]}>{label}</Text>
    </Pressable>
  );

  return (
    <LinearGradient colors={[colors.bgTop, colors.bgMid, colors.bgBottom]} style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.iconBtnText}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>🛡️ Admin</Text>
          <Pressable style={styles.iconBtn} onPress={load}>
            <Text style={styles.iconBtnText}>↻</Text>
          </Pressable>
        </View>

        {!isAdmin ? (
          <View style={[styles.deniedCard, shadows.soft]}>
            <Text style={styles.deniedEmoji}>🔒</Text>
            <Text style={styles.deniedText}>Vous n'avez pas les droits administrateur.</Text>
          </View>
        ) : (
          <>
            {/* Tabs */}
            <View style={[styles.tabs, shadows.soft]}>
              <TabBtn k="users" label="Utilisateurs" />
              <TabBtn k="revenue" label="Revenus" />
              <TabBtn k="grants" label="Accès manuel" />
            </View>

            {tab === "users" && (
              <>
                <TextInput
                  style={[styles.search, shadows.soft]}
                  placeholder="Rechercher par email ou nom…"
                  placeholderTextColor={colors.textFaint}
                  value={search}
                  onChangeText={setSearch}
                  autoCapitalize="none"
                />
                {loading ? (
                  <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
                ) : (
                  <>
                    <Text style={styles.count}>{filtered.length} utilisateurs</Text>
                    {filtered.map((u) => {
                      const badge = statusBadge(u);
                      const joined = fmtShort(u.created_at);
                      const lastActive = fmtShort(u.last_sign_in_at);
                      return (
                        <View key={u.id} style={[styles.userCard, shadows.soft]}>
                          <View style={styles.userAvatar}>
                            <Text style={styles.userAvatarText}>{initials(u)}</Text>
                          </View>
                          <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={styles.userName}>{u.display_name || "Sans nom"}</Text>
                            <Text style={styles.userEmail} numberOfLines={1}>{u.email}</Text>
                            <Text style={styles.userMeta}>
                              Inscrit {joined || "—"}
                              {lastActive ? ` · Actif ${lastActive}` : ""}
                            </Text>
                          </View>
                          <View style={{ alignItems: "flex-end", gap: 8 }}>
                            <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                              <Text style={[styles.badgeText, { color: badge.fg }]}>{badge.label}</Text>
                            </View>
                            {!u.subscription?.is_manual_grant && u.subscription?.status !== "active" && (
                              <Pressable
                                style={[styles.grantBtn, busyId === u.id && { opacity: 0.5 }]}
                                onPress={() => toggleAccess(u)}
                                disabled={busyId != null}
                              >
                                {busyId === u.id ? (
                                  <ActivityIndicator color={colors.white} size="small" />
                                ) : (
                                  <Text style={styles.grantText}>Accorder</Text>
                                )}
                              </Pressable>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </>
                )}
              </>
            )}

            {tab === "revenue" && (
              <>
                <View style={[styles.revenueHero, shadows.card]}>
                  <Text style={styles.revenueLabel}>Revenus mensuels estimés</Text>
                  <Text style={styles.revenueTotal}>{fmtUSD(totalMonthly)}</Text>
                  <Text style={styles.revenueSub}>basé sur les abonnements actifs</Text>
                </View>
                <View style={styles.revRow}>
                  <View style={[styles.revCard, shadows.soft]}>
                    <Text style={styles.revNum}>{active.length}</Text>
                    <Text style={styles.revLabel}>Abonnés actifs</Text>
                  </View>
                  <View style={[styles.revCard, shadows.soft]}>
                    <Text style={styles.revNum}>{monthly.length}</Text>
                    <Text style={styles.revLabel}>Mensuels</Text>
                  </View>
                </View>
                <View style={styles.revRow}>
                  <View style={[styles.revCard, shadows.soft]}>
                    <Text style={styles.revNum}>{annual.length}</Text>
                    <Text style={styles.revLabel}>Annuel</Text>
                  </View>
                  <View style={[styles.revCard, shadows.soft]}>
                    <Text style={styles.revNum}>{grants.length}</Text>
                    <Text style={styles.revLabel}>Accès manuels</Text>
                  </View>
                </View>
              </>
            )}

            {tab === "grants" && (
              <>
                <Text style={styles.sectionHint}>
                  Accorder / révoquer l'accès Premium manuellement (comme le web).
                </Text>
                {loading ? (
                  <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
                ) : (
                  users.map((u) => {
                    const granted = u.subscription?.is_manual_grant === true;
                    return (
                      <View key={u.id} style={[styles.userCard, shadows.soft]}>
                        <View style={styles.userAvatar}>
                          <Text style={styles.userAvatarText}>{initials(u)}</Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={styles.userEmail} numberOfLines={1}>{u.email}</Text>
                          {granted && <Text style={styles.grantedLabel}>✓ Premium (manuel)</Text>}
                        </View>
                        <Pressable
                          style={[styles.grantBtn, granted && styles.revokeBtn, busyId === u.id && { opacity: 0.5 }]}
                          onPress={() => toggleAccess(u)}
                          disabled={busyId != null}
                        >
                          {busyId === u.id ? (
                            <ActivityIndicator color={colors.white} size="small" />
                          ) : (
                            <Text style={styles.grantText}>{granted ? "Révoquer" : "Accorder"}</Text>
                          )}
                        </Pressable>
                      </View>
                    );
                  })
                )}
              </>
            )}
          </>
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
    width: 40, height: 40, borderRadius: 999,
    backgroundColor: colors.cardGlassStrong, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.glassBorder,
  },
  iconBtnText: { fontSize: 20, color: colors.primary, fontFamily: fonts.bodyBold },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 18, color: colors.text, fontFamily: fonts.displayBold },
  deniedCard: { ...glassCard, padding: 28, alignItems: "center" },
  deniedEmoji: { fontSize: 36, marginBottom: 8 },
  deniedText: { fontSize: 14, color: colors.textMuted, textAlign: "center", fontFamily: fonts.body },
  tabs: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.5)",
    borderRadius: 999,
    padding: 4,
    marginBottom: 16,
  },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: "center" },
  tabBtnActive: { backgroundColor: "rgba(255,255,255,0.85)" },
  tabText: { fontSize: 13, color: colors.textMuted, fontFamily: fonts.bodySemiBold },
  search: {
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 11,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    fontFamily: fonts.body,
    marginBottom: 12,
  },
  count: { fontSize: 12, color: colors.textMuted, marginBottom: 8, fontFamily: fonts.bodyMedium },
  userCard: {
    ...glassCard,
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    marginBottom: 10,
  },
  userAvatar: {
    width: 40, height: 40, borderRadius: 999,
    backgroundColor: "rgba(29,129,237,0.12)",
    alignItems: "center", justifyContent: "center",
  },
  userAvatarText: { fontSize: 14, color: colors.primary, fontWeight: "700", fontFamily: fonts.bodyBold },
  userName: { fontSize: 14, color: colors.text, fontFamily: fonts.bodySemiBold },
  userEmail: { fontSize: 12, color: colors.textMuted, marginTop: 1, fontFamily: fonts.body },
  userMeta: { fontSize: 10, color: colors.textFaint, marginTop: 3, fontFamily: fonts.body },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: "700", fontFamily: fonts.bodySemiBold },
  grantBtn: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    minWidth: 84,
    alignItems: "center",
  },
  revokeBtn: { backgroundColor: "#dc2626" },
  grantText: { color: colors.white, fontSize: 12, fontWeight: "700", fontFamily: fonts.bodySemiBold },
  revenueHero: {
    ...glassCard,
    padding: 26,
    alignItems: "center",
    marginBottom: 14,
  },
  revenueLabel: { fontSize: 13, color: colors.textMuted, fontFamily: fonts.bodyMedium },
  revenueTotal: { fontSize: 40, color: colors.primary, fontFamily: fonts.displayBold, marginVertical: 6 },
  revenueSub: { fontSize: 11, color: colors.textFaint, fontFamily: fonts.body },
  revRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  revCard: { ...glassCard, flex: 1, padding: 16, alignItems: "center" },
  revNum: { fontSize: 26, color: colors.text, fontFamily: fonts.displayBold },
  revLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2, fontFamily: fonts.bodyMedium },
  sectionHint: { fontSize: 12, color: colors.textMuted, marginBottom: 12, fontFamily: fonts.body },
  grantedLabel: { fontSize: 11, color: "#7c3aed", fontFamily: fonts.bodySemiBold, marginTop: 2 },
});
