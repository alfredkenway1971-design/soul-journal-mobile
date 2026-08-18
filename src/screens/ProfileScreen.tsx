import { useEffect, useState, useMemo } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Alert, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, shadows } from "@/theme";
import { useAppFonts, type AppFonts } from "@/hooks/useAppFonts";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { useSettingsStore, useT } from "@/store/settingsStore";
import { useSubscriptionStore } from "@/store/subscriptionStore";
import { LANGUAGES } from "@/i18n/translations";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";

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

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.display_name) setDisplayName(data.display_name);
        if (data?.avatar_url) setAvatarUrl(data.avatar_url);
      });
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

  return (
    <LinearGradient colors={[colors.bgTop, colors.bgMid, colors.bgBottom]} style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>👤 {t("nav.profile")}</Text>

        <View style={[styles.card, shadows.card]}>
        <Pressable style={styles.profileHeader} onPress={() => navigation.navigate("ProfileSettings")}>
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
          <Text style={styles.rowArrow}>→</Text>
        </Pressable>
        </View>

        {/* Language switcher */}
        <Text style={styles.sectionLabel}>🌐 {t("nav.library") === "Bibliothèque" ? "Langue" : "Language"}</Text>
        <View style={[styles.langCard, shadows.soft]}>
          {LANGUAGES.map((l, i) => {
            const active = l.code === language;
            return (
              <Pressable
                key={l.code}
                style={[styles.langRow, i < LANGUAGES.length - 1 && styles.langRowBorder, active && styles.langRowActive]}
                onPress={() => setLanguage(l.code)}
              >
                <Text style={styles.langFlag}>{l.flag}</Text>
                <Text style={[styles.langName, active && { color: colors.primary, fontWeight: "700" }]}>
                  {l.native}
                </Text>
                {active && <Text style={styles.langCheck}>✓</Text>}
              </Pressable>
            );
          })}
        </View>

        {/* Phase 2: Goals, Relations, Voice, AI features, Manage subscription */}
        <Pressable style={[styles.row, shadows.soft]} onPress={() => navigation.navigate("Goals")}>
          <View style={styles.rowIcon}>
            <Ionicons name="flag-outline" size={18} color={colors.primary} />
          </View>
          <Text style={styles.rowLabel}>{t("profile.objectives")}</Text>
          <Text style={styles.rowArrow}>→</Text>
        </Pressable>
        <Pressable style={[styles.row, shadows.soft]} onPress={() => navigation.navigate("SoulMirror")}>
          <View style={styles.rowIcon}>
            <Ionicons name="sparkles-outline" size={18} color={colors.primary} />
          </View>
          <Text style={styles.rowLabel}>Soul Mirror</Text>
          <Text style={styles.rowArrow}>→</Text>
        </Pressable>
        <Pressable style={[styles.row, shadows.soft]} onPress={() => navigation.navigate("Voice")}>
          <View style={styles.rowIcon}>
            <Ionicons name="mic-outline" size={18} color={colors.primary} />
          </View>
          <Text style={styles.rowLabel}>{t("profile.voice")}</Text>
          <Text style={styles.rowArrow}>→</Text>
        </Pressable>
        <Pressable style={[styles.row, shadows.soft]} onPress={() => navigation.navigate("Pricing")}>
          <View style={styles.rowIcon}>
            <Ionicons name="diamond-outline" size={18} color={colors.primary} />
          </View>
          <Text style={styles.rowLabel}>{t("profile.premium")}</Text>
          <Text style={styles.rowArrow}>→</Text>
        </Pressable>
        <Pressable style={[styles.row, shadows.soft]} onPress={() => navigation.navigate("BookBuilder")}>
          <View style={styles.rowIcon}>
            <Ionicons name="book-outline" size={18} color={colors.primary} />
          </View>
          <Text style={styles.rowLabel}>Livre (PDF)</Text>
          <Text style={styles.rowArrow}>→</Text>
        </Pressable>
        <Pressable style={[styles.row, shadows.soft]} onPress={() => navigation.navigate("Export")}>
          <View style={styles.rowIcon}>
            <Ionicons name="download-outline" size={18} color={colors.primary} />
          </View>
          <Text style={styles.rowLabel}>Exporter (PDF)</Text>
          <Text style={styles.rowArrow}>→</Text>
        </Pressable>
        <Pressable style={[styles.row, shadows.soft]} onPress={() => navigation.navigate("Calendar")}>
          <View style={styles.rowIcon}>
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
          </View>
          <Text style={styles.rowLabel}>Calendrier</Text>
          <Text style={styles.rowArrow}>→</Text>
        </Pressable>
        <Pressable style={[styles.row, shadows.soft]} onPress={() => navigation.navigate("Insights")}>
          <View style={styles.rowIcon}>
            <Ionicons name="bar-chart-outline" size={18} color={colors.primary} />
          </View>
          <Text style={styles.rowLabel}>Aperçus</Text>
          <Text style={styles.rowArrow}>→</Text>
        </Pressable>
        <Pressable style={[styles.row, shadows.soft]} onPress={() => navigation.navigate("Coaching")}>
          <View style={styles.rowIcon}>
            <Ionicons name="school-outline" size={18} color={colors.primary} />
          </View>
          <Text style={styles.rowLabel}>Coaching IA</Text>
          <Text style={styles.rowArrow}>→</Text>
        </Pressable>
        <Pressable style={[styles.row, shadows.soft]} onPress={() => navigation.navigate("Gratitude")}>
          <View style={styles.rowIcon}>
            <Ionicons name="heart-outline" size={18} color={colors.primary} />
          </View>
          <Text style={styles.rowLabel}>Gratitude</Text>
          <Text style={styles.rowArrow}>→</Text>
        </Pressable>
        <Pressable style={[styles.row, shadows.soft]} onPress={() => navigation.navigate("Relations")}>
          <View style={styles.rowIcon}>
            <Ionicons name="people-outline" size={18} color={colors.primary} />
          </View>
          <Text style={styles.rowLabel}>Relations</Text>
          <Text style={styles.rowArrow}>→</Text>
        </Pressable>
        <Pressable style={[styles.row, shadows.soft]} onPress={() => navigation.navigate("Fonts")}>
          <View style={styles.rowIcon}>
            <Ionicons name="text-outline" size={18} color={colors.primary} />
          </View>
          <Text style={styles.rowLabel}>Police d'écriture</Text>
          <Text style={styles.rowArrow}>→</Text>
        </Pressable>
        <Pressable style={[styles.row, shadows.soft]} onPress={() => navigation.navigate("Themes")}>
          <View style={styles.rowIcon}>
            <Ionicons name="color-palette-outline" size={18} color={colors.primary} />
          </View>
          <Text style={styles.rowLabel}>Thèmes</Text>
          <Text style={styles.rowArrow}>→</Text>
        </Pressable>
        <Pressable style={[styles.row, shadows.soft]} onPress={() => navigation.navigate("PinSettings")}>
          <View style={styles.rowIcon}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.primary} />
          </View>
          <Text style={styles.rowLabel}>Code PIN</Text>
          <Text style={styles.rowArrow}>→</Text>
        </Pressable>
        <Pressable style={[styles.row, shadows.soft]} onPress={() => navigation.navigate("Security")}>
          <View style={styles.rowIcon}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
          </View>
          <Text style={styles.rowLabel}>Sécurité</Text>
          <Text style={styles.rowArrow}>→</Text>
        </Pressable>
        <Pressable style={[styles.row, shadows.soft]} onPress={() => navigation.navigate("Admin")}>
          <View style={styles.rowIcon}>
            <Ionicons name="shield-outline" size={18} color={colors.primary} />
          </View>
          <Text style={styles.rowLabel}>Admin</Text>
          <Text style={styles.rowArrow}>→</Text>
        </Pressable>
        <Pressable style={[styles.row, shadows.soft]} onPress={() => navigation.navigate("Reminders")}>
          <View style={styles.rowIcon}>
            <Ionicons name="notifications-outline" size={18} color={colors.primary} />
          </View>
          <Text style={styles.rowLabel}>Rappels</Text>
          <Text style={styles.rowArrow}>→</Text>
        </Pressable>
        <Pressable style={[styles.row, shadows.soft]} onPress={() => navigation.navigate("Privacy")}>
          <View style={styles.rowIcon}>
            <Ionicons name="document-text-outline" size={18} color={colors.primary} />
          </View>
          <Text style={styles.rowLabel}>{t("profile.privacy")}</Text>
          <Text style={styles.rowArrow}>→</Text>
        </Pressable>
        <Pressable style={[styles.row, shadows.soft]} onPress={() => Alert.alert("Soul Journal", t("profile.version"))}>
          <View style={styles.rowIcon}>
            <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
          </View>
          <Text style={styles.rowLabel}>{t("profile.about")}</Text>
          <Text style={styles.rowArrow}>→</Text>
        </Pressable>

        <Pressable style={styles.signOut} onPress={doSignOut}>
          <Text style={styles.signOutText}>{t("profile.signOut")}</Text>
        </Pressable>
      </ScrollView>
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
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
  },
  profileHeader: { flexDirection: "row", alignItems: "center" },
  avatarWrap: { marginRight: 14 },
  avatarImage: { width: 56, height: 56, borderRadius: 999, borderWidth: 2, borderColor: "rgba(255,255,255,0.8)" },
  avatarFallback: {
    width: 56, height: 56, borderRadius: 999,
    backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "rgba(255,255,255,0.8)",
  },
  avatarText: { color: colors.white, fontSize: 22, fontWeight: "700", fontFamily: appFonts.bodyBold },
  name: { fontSize: 20, color: colors.text, fontFamily: appFonts.displayBold },
  email: { fontSize: 13, color: colors.textMuted, marginTop: 4, fontFamily: appFonts.body },
  premiumBadge: {
    marginTop: 10,
    backgroundColor: "#fef3c7",
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 5,
    alignSelf: "flex-start",
  },
  premiumBadgeText: { fontSize: 12, color: "#b45309", fontFamily: appFonts.bodySemiBold },
  sectionLabel: { fontSize: 13, color: colors.textMuted, marginTop: 8, marginBottom: 8, fontFamily: appFonts.bodySemiBold },
  langCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  langRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  langRowBorder: { borderBottomWidth: 1, borderBottomColor: "#eef1f5" },
  langRowActive: {},
  langFlag: { fontSize: 17, marginRight: 12 },
  langName: { flex: 1, fontSize: 15, color: colors.text, fontFamily: appFonts.body },
  langCheck: { fontSize: 15, color: colors.primary, fontWeight: "700" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 15,
    marginBottom: 10,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#eaf3fd",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  rowEmoji: { fontSize: 17 },
  rowLabel: { flex: 1, fontSize: 15, color: colors.text, fontFamily: appFonts.bodySemiBold },
  rowArrow: { fontSize: 16, color: "#c3ccd6" },
  signOut: { marginTop: 24, alignItems: "center", paddingVertical: 14 },
  signOutText: { color: colors.danger, fontSize: 15, fontWeight: "600", fontFamily: appFonts.bodySemiBold },
});
