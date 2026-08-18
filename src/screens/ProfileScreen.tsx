import { useEffect, useState, useMemo } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Alert, Image, Modal } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, shadows } from "@/theme";
import { useAppFonts, type AppFonts } from "@/hooks/useAppFonts";
import { supabase } from "@/lib/supabase";
import { resolveAvatarUrl } from "@/lib/avatar";
import { useAuthStore } from "@/store/authStore";
import { useSettingsStore, useT } from "@/store/settingsStore";
import { useSubscriptionStore } from "@/store/subscriptionStore";
import { LANGUAGES } from "@/i18n/translations";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

interface RowDef {
  icon: IconName;
  label: string;
  onPress: () => void;
  badge?: string;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 22 }}>
      <Text style={sectionStyles.label}>{title}</Text>
      <View style={sectionStyles.group}>{children}</View>
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#7a8ca3",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  group: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "rgba(26,63,110,0.10)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
});

export default function ProfileScreen() {
  const { user, signOut } = useAuthStore();
  const appFonts = useAppFonts();
  const styles = useMemo(() => makeStyles(appFonts), [appFonts]);
  const t = useT();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const isPremium = useSubscriptionStore((s) => s.isPremium);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [langPickerOpen, setLangPickerOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.display_name) setDisplayName(data.display_name);
        if (data?.avatar_url) {
          // Stored URL may be a broken single-nested path — resolve the real one
          resolveAvatarUrl(data.avatar_url).then(setAvatarUrl);
        }
      });
    // Admin flag (same check as the Admin screen — only admins see the row)
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .then(({ data }) => setIsAdmin(!!data?.length));
  }, [user]);

  const doSignOut = () => {
    Alert.alert(t("nav.profile"), t("profile.signOutConfirm"), [
      { text: t("profile.cancel"), style: "cancel" },
      { text: t("profile.signOut"), style: "destructive", onPress: () => signOut() },
    ]);
  };

  const initials = (displayName || user?.email || "SJ")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const activeLang = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0];
  const go = (screen: keyof RootStackParamList) => navigation.navigate(screen as any);

  const rows = (defs: RowDef[]) =>
    defs.map((r, i) => (
      <Pressable
        key={r.label + i}
        style={({ pressed }) => [styles.row, i < defs.length - 1 && styles.rowBorder, pressed && { backgroundColor: "#f4f8fd" }]}
        onPress={r.onPress}
      >
        <View style={styles.rowIcon}>
          <Ionicons name={r.icon} size={17} color={colors.primary} />
        </View>
        <Text style={styles.rowLabel}>{r.label}</Text>
        {r.badge && <View style={styles.rowBadge}><Text style={styles.rowBadgeText}>{r.badge}</Text></View>}
        <Ionicons name="chevron-forward" size={16} color="#b6c2d0" />
      </Pressable>
    ));

  return (
    <LinearGradient colors={[colors.bgTop, colors.bgMid, colors.bgBottom]} style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>👤 {t("nav.profile")}</Text>

        {/* ── Account ── */}
        <Section title={t("profile.sectionAccount")}>
          <Pressable
            style={({ pressed }) => [styles.profileHeader, pressed && { backgroundColor: "#f4f8fd" }]}
            onPress={() => go("ProfileSettings")}
          >
            <View style={styles.avatarWrap}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{displayName || "Soul Journal"}</Text>
              <Text style={styles.email}>{user?.email}</Text>
              {isPremium && (
                <View style={styles.premiumBadge}>
                  <Text style={styles.premiumBadgeText}>👑 Premium</Text>
                </View>
              )}
            </View>
            <Ionicons name="chevron-forward" size={16} color="#b6c2d0" />
          </Pressable>
        </Section>

        {/* ── Premium (upgrade touchpoint — visually distinct) ── */}
        <Section title="">
          <Pressable style={({ pressed }) => [styles.premiumCard, pressed && { opacity: 0.92 }]} onPress={() => go("Pricing")}>
            <LinearGradient
              colors={isPremium ? ["#fff7e6", "#fef3c7"] : ["#1d81ed", "#4a9df2"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.premiumGradient}
            >
              <View style={styles.premiumRow}>
                <View style={[styles.crownChip, isPremium && { backgroundColor: "#fbbf24" }]}>
                  <Ionicons name="diamond" size={18} color={isPremium ? "#7c3aed" : "#ffffff"} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.premiumTitle, { color: isPremium ? "#92400e" : "#ffffff" }]}>
                    {isPremium ? "Soul Journal Premium" : t("profile.goUpgrade")}
                  </Text>
                  <Text style={[styles.premiumDesc, { color: isPremium ? "#a16207" : "rgba(255,255,255,0.92)" }]}>
                    {isPremium ? t("profile.premiumThanks") : t("profile.premiumDesc")}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={isPremium ? "#92400e" : "#ffffff"} />
              </View>
            </LinearGradient>
          </Pressable>
        </Section>

        {/* ── Appearance ── */}
        <Section title={t("profile.sectionAppearance")}>
          {rows([
            { icon: "color-palette-outline", label: t("profile.themes"), onPress: () => go("Themes") },
            { icon: "text-outline", label: t("profile.fonts"), onPress: () => go("Fonts") },
          ])}
        </Section>

        {/* ── Voice & Language ── */}
        <Section title={t("profile.sectionVoiceLang")}>
          {rows([
            { icon: "mic-outline", label: t("profile.myVoice"), onPress: () => go("Voice"), badge: "Premium" },
          ])}
          <Pressable
            style={({ pressed }) => [styles.row, styles.rowBorder, pressed && { backgroundColor: "#f4f8fd" }]}
            onPress={() => setLangPickerOpen(true)}
          >
            <View style={styles.rowIcon}>
              <Ionicons name="language-outline" size={17} color={colors.primary} />
            </View>
            <Text style={styles.rowLabel}>{t("profile.language")}</Text>
            <Text style={styles.langCurrent}>{activeLang.flag} {activeLang.native}</Text>
            <Ionicons name="chevron-forward" size={16} color="#b6c2d0" />
          </Pressable>
        </Section>

        {/* ── Content Tools ── */}
        <Section title={t("profile.sectionContentTools")}>
          {rows([
            { icon: "book-outline", label: t("profile.bookPdf"), onPress: () => go("BookBuilder"), badge: "Premium" },
            { icon: "download-outline", label: t("profile.exportPdf"), onPress: () => go("Export") },
            { icon: "calendar-outline", label: t("profile.calendar"), onPress: () => go("Calendar") },
            { icon: "bar-chart-outline", label: t("profile.insights"), onPress: () => go("Insights") },
            { icon: "school-outline", label: t("profile.coaching"), onPress: () => go("Coaching") },
          ])}
        </Section>

        {/* ── Wellbeing ── */}
        <Section title={t("profile.sectionWellbeing")}>
          {rows([
            { icon: "heart-outline", label: "Gratitude", onPress: () => go("Gratitude") },
            { icon: "people-outline", label: "Relations", onPress: () => go("Relations") },
            { icon: "flag-outline", label: "Objectifs", onPress: () => go("Goals") },
            { icon: "sparkles-outline", label: t("profile.soulMirror"), onPress: () => go("SoulMirror"), badge: "Premium" },
          ])}
        </Section>

        {/* ── Notifications ── */}
        <Section title={t("profile.sectionNotifications")}>
          {rows([
            { icon: "notifications-outline", label: "Rappels", onPress: () => go("Reminders") },
          ])}
        </Section>

        {/* ── Security ── */}
        <Section title={t("profile.sectionSecurity")}>
          {rows([
            { icon: "lock-closed-outline", label: t("profile.pin"), onPress: () => go("PinSettings") },
            { icon: "shield-checkmark-outline", label: t("profile.security"), onPress: () => go("Security") },
          ])}
        </Section>

        {/* ── Legal & Info ── */}
        <Section title={t("profile.sectionLegal")}>
          {rows([
            { icon: "document-text-outline", label: t("profile.privacy"), onPress: () => go("Privacy") },
            { icon: "information-circle-outline", label: t("profile.about"), onPress: () => Alert.alert("Soul Journal", t("profile.version")) },
            ...(isAdmin
              ? [{ icon: "shield-outline" as IconName, label: t("admin.title"), onPress: () => go("Admin") }]
              : []),
          ])}
        </Section>

        <Pressable style={styles.signOut} onPress={doSignOut}>
          <Ionicons name="log-out-outline" size={18} color={colors.danger} style={{ marginRight: 8 }} />
          <Text style={styles.signOutText}>{t("profile.signOut")}</Text>
        </Pressable>
      </ScrollView>

      {/* Language picker modal */}
      <Modal visible={langPickerOpen} transparent animationType="fade" onRequestClose={() => setLangPickerOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setLangPickerOpen(false)}>
          <Pressable style={[styles.modalCard, shadows.card]} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>🌐 {t("profile.language")}</Text>
            {LANGUAGES.map((l, i) => {
              const active = l.code === language;
              return (
                <Pressable
                  key={l.code}
                  style={[styles.modalLangRow, i < LANGUAGES.length - 1 && styles.modalLangBorder, active && styles.modalLangActive]}
                  onPress={async () => {
                    await setLanguage(l.code);
                    setLangPickerOpen(false);
                  }}
                >
                  <Text style={styles.modalLangFlag}>{l.flag}</Text>
                  <Text style={[styles.modalLangName, active && { color: colors.primary, fontWeight: "700" }]}>
                    {l.native}
                  </Text>
                  {active && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </LinearGradient>
  );
}

const makeStyles = (appFonts: AppFonts) => StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, paddingBottom: 110 },
  title: {
    fontSize: 26,
    color: colors.text,
    fontFamily: appFonts.displayBold,
    marginBottom: 16,
  },
  // Account header card
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
  },
  avatarWrap: { marginRight: 14 },
  avatarImage: { width: 56, height: 56, borderRadius: 999, borderWidth: 2, borderColor: "#ffffff" },
  avatarFallback: {
    width: 56, height: 56, borderRadius: 999,
    backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#ffffff",
  },
  avatarText: { color: colors.white, fontSize: 22, fontWeight: "700", fontFamily: appFonts.bodyBold },
  name: { fontSize: 19, color: colors.text, fontFamily: appFonts.displayBold },
  email: { fontSize: 13, color: colors.textMuted, marginTop: 3, fontFamily: appFonts.body },
  premiumBadge: {
    marginTop: 8,
    backgroundColor: "#fef3c7",
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  premiumBadgeText: { fontSize: 11, color: "#b45309", fontFamily: appFonts.bodySemiBold },
  // Premium upsell card
  premiumCard: {
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "rgba(26,63,110,0.15)",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 22,
  },
  premiumGradient: { padding: 18 },
  premiumRow: { flexDirection: "row", alignItems: "center" },
  crownChip: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  premiumTitle: { fontSize: 16, fontFamily: appFonts.displayBold },
  premiumDesc: { fontSize: 12, marginTop: 3, fontFamily: appFonts.body },
  // Rows
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: "#eef2f6" },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#eaf3fd",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  rowLabel: { flex: 1, fontSize: 15, color: colors.text, fontFamily: appFonts.bodySemiBold },
  rowBadge: {
    backgroundColor: "#fef3c7",
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 6,
  },
  rowBadgeText: { fontSize: 10, color: "#b45309", fontWeight: "700", fontFamily: appFonts.bodyBold },
  langCurrent: { fontSize: 13, color: colors.textMuted, marginRight: 6, fontFamily: appFonts.body },
  signOut: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  signOutText: { color: colors.danger, fontSize: 15, fontWeight: "600", fontFamily: appFonts.bodySemiBold },
  // Language modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,30,50,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    paddingVertical: 8,
    width: "100%",
    maxWidth: 380,
  },
  modalTitle: {
    fontSize: 16,
    color: colors.text,
    fontFamily: appFonts.displayBold,
    textAlign: "center",
    paddingVertical: 14,
  },
  modalLangRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  modalLangBorder: { borderBottomWidth: 1, borderBottomColor: "#eef2f6" },
  modalLangActive: { backgroundColor: "#eaf3fd" },
  modalLangFlag: { fontSize: 18, marginRight: 12 },
  modalLangName: { flex: 1, fontSize: 15, color: colors.text, fontFamily: appFonts.body },
});
