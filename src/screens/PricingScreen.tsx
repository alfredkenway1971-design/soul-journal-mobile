import { useCallback, useEffect, useState, useMemo } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { colors, radius, fonts, glassCard, shadows } from "@/theme";
import { useAppFonts, type AppFonts } from "@/hooks/useAppFonts";
import { useT } from "@/store/settingsStore";
import { useSubscriptionStore } from "@/store/subscriptionStore";
import { initBilling, getProducts, subscribe, restorePurchases, PRODUCT_IDS } from "@/lib/billing";

export default function PricingScreen() {
  const navigation = useNavigation();
  const appFonts = useAppFonts();
  const styles = useMemo(() => makeStyles(appFonts), [appFonts]);
  const t = useT();
  const isPremium = useSubscriptionStore((s) => s.isPremium);
  const [monthlyPrice, setMonthlyPrice] = useState("$12.99");
  const [yearlyPrice, setYearlyPrice] = useState("$99.99");
  const subscriptionEnd = useSubscriptionStore((s) => s.subscriptionEnd);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const ok = await initBilling();
      if (ok) {
        const products = await getProducts();
        products.forEach((p) => {
          if (p.productId === PRODUCT_IDS.monthly && p.price) setMonthlyPrice(p.price);
          if (p.productId === PRODUCT_IDS.yearly && p.price) setYearlyPrice(p.price);
        });
      }
    })();
  }, []);

  const doSubscribe = useCallback(async (sku: string) => {
    if (isPremium) return;
    setBusy(sku);
    const res = await subscribe(sku);
    setBusy(null);
    if (!res.ok) {
      Alert.alert(t("profile.comingSoon"), res.error ?? "Purchase failed.");
    }
  }, [isPremium, t]);

  if (isPremium) {
    return (
      <LinearGradient colors={[colors.bgTop, colors.bgMid, colors.bgBottom]} style={styles.root}>
        <View style={styles.headerRow}>
          <Pressable style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.iconBtnText}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{t("pricing.title")}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={[styles.activeCard, shadows.card]}>
          <Text style={styles.activeEmoji}>👑</Text>
          <Text style={styles.activeTitle}>{t("pricing.youArePremium")}</Text>
          <Text style={styles.activeDesc}>{t("pricing.allUnlocked")}</Text>
          {subscriptionEnd ? (
            <Text style={styles.activeEnd}>
              {t("pricing.endsOn")} {new Date(subscriptionEnd).toLocaleDateString()}
            </Text>
          ) : null}
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={[colors.bgTop, colors.bgMid, colors.bgBottom]} style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.iconBtnText}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{t("pricing.title")}</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={[styles.hero, shadows.card]}>
          <Text style={styles.heroEmoji}>✨</Text>
          <Text style={styles.heroTitle}>{t("pricing.unlockAll")}</Text>
          <Text style={styles.heroDesc}>
            {t("pricing.features")}
          </Text>
        </View>

        {/* Monthly */}
        <Pressable
          style={[styles.tierCard, shadows.card, busy === PRODUCT_IDS.monthly && { opacity: 0.6 }]}
          onPress={() => doSubscribe(PRODUCT_IDS.monthly)}
          disabled={busy != null}
        >
          <View style={styles.tierTop}>
            <Text style={styles.tierName}>{t("pricing.monthly")}</Text>
            <Text style={styles.tierPrice}>{monthlyPrice}<Text style={styles.tierPer}>{t("pricing.perMonth")}</Text></Text>
          </View>
          <Text style={styles.tierDesc}>{t("pricing.cancellable")}</Text>
          {busy === PRODUCT_IDS.monthly && <ActivityIndicator color={colors.white} style={{ marginTop: 12 }} />}
        </Pressable>

        {/* Yearly (recommended) */}
        <Pressable
          style={[styles.tierCard, styles.tierYearly, shadows.card, busy === PRODUCT_IDS.yearly && { opacity: 0.6 }]}
          onPress={() => doSubscribe(PRODUCT_IDS.yearly)}
          disabled={busy != null}
        >
          <View style={styles.saveBadge}>
            <Text style={styles.saveBadgeText}>{t("pricing.save36")}</Text>
          </View>
          <View style={styles.tierTop}>
            <Text style={[styles.tierName, { color: colors.white }]}>{t("pricing.yearly")}</Text>
            <Text style={[styles.tierPrice, { color: colors.white }]}>{yearlyPrice}<Text style={styles.tierPer}>{t("pricing.perYear")}</Text></Text>
          </View>
          <Text style={[styles.tierDesc, { color: "rgba(255,255,255,0.85)" }]}>
            {t("pricing.bestChoice").replace("{price}", `$${(parseFloat(yearlyPrice.replace("$", "")) / 12).toFixed(2)}`)}
          </Text>
          {busy === PRODUCT_IDS.yearly && <ActivityIndicator color={colors.white} style={{ marginTop: 12 }} />}
        </Pressable>

        {/* Premium feature list (included language — no "unlimited") */}
        <View style={[styles.featureCard, shadows.card]}>
          <Text style={styles.featureTitle}>✨ {t("pricing.unlockAll")}</Text>
          {t("pricing.featureList")
            .split("|")
            .map((f, i) => (
              <Text key={i} style={styles.featureItem}>
                • {f}
              </Text>
            ))}
        </View>

        <Pressable style={styles.restoreBtn} onPress={async () => {
          const ok = await restorePurchases();
          Alert.alert(t("pricing.restore"), ok ? t("pricing.restored") : t("pricing.nothingToRestore"));
        }}>
          <Text style={styles.restoreText}>{t("pricing.restore")}</Text>
        </Pressable>

        <Text style={styles.footnote}>
          {t("pricing.playNote")}
        </Text>
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
  headerTitle: { flex: 1, textAlign: "center", fontSize: 18, color: colors.text, fontFamily: appFonts.displayBold },
  hero: {
    ...glassCard,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
  },
  heroEmoji: { fontSize: 34, marginBottom: 8 },
  heroTitle: { fontSize: 18, color: colors.text, fontFamily: appFonts.displayBold, textAlign: "center" },
  heroDesc: { fontSize: 13, color: colors.textMuted, textAlign: "center", marginTop: 6, lineHeight: 19, fontFamily: appFonts.body },
  tierCard: {
    ...glassCard,
    padding: 20,
    marginBottom: 14,
  },
  tierYearly: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  saveBadge: {
    position: "absolute",
    top: -10,
    right: 16,
    backgroundColor: "#f59e0b",
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  saveBadgeText: { color: colors.white, fontSize: 11, fontWeight: "700", fontFamily: appFonts.bodyBold },
  tierTop: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  tierName: { fontSize: 16, color: colors.text, fontFamily: appFonts.displayBold },
  tierPrice: { fontSize: 24, color: colors.text, fontFamily: appFonts.bodyBold },
  tierPer: { fontSize: 13, color: colors.textMuted, fontFamily: appFonts.body },
  tierDesc: { fontSize: 12, color: colors.textMuted, marginTop: 8, fontFamily: appFonts.body },
  restoreBtn: { alignItems: "center", paddingVertical: 14 },
  restoreText: { color: colors.primary, fontSize: 14, fontWeight: "600", fontFamily: appFonts.bodySemiBold },
  footnote: { fontSize: 11, color: colors.textFaint, textAlign: "center", marginTop: 8, lineHeight: 16, fontFamily: appFonts.body },
  activeCard: {
    ...glassCard,
    padding: 32,
    alignItems: "center",
  },
  activeEmoji: { fontSize: 44, marginBottom: 10 },
  activeTitle: { fontSize: 20, color: colors.text, fontFamily: appFonts.displayBold },
  activeDesc: { fontSize: 14, color: colors.textMuted, marginTop: 6, fontFamily: appFonts.body },
  activeEnd: { fontSize: 12, color: colors.primary, marginTop: 10, fontFamily: appFonts.bodySemiBold, textAlign: "center" },
  featureCard: {
    ...glassCard,
    padding: 18,
    marginBottom: 6,
  },
  featureTitle: { fontSize: 15, color: colors.text, fontFamily: appFonts.displayBold, marginBottom: 8 },
  featureItem: { fontSize: 13, color: colors.textMuted, lineHeight: 21, fontFamily: appFonts.body },
});
