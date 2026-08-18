import { View, Text, StyleSheet } from "react-native";
import { useMemo } from "react";
import { colors, radius, glassCard, shadows } from "@/theme";
import { useAppFonts, type AppFonts } from "@/hooks/useAppFonts";
import { useT } from "@/store/settingsStore";

interface Props {
  title: string;
  description: string;
}

/** Premium locked card — shown for non-premium users on premium features. */
export default function UpgradePrompt({ title, description }: Props) {
  const appFonts = useAppFonts();
  const t = useT();
  const styles = useMemo(() => makeStyles(appFonts), [appFonts]);
  return (
    <View style={[styles.card, shadows.card]}>
      <View style={styles.lockWrap}>
        <Text style={styles.lockEmoji}>🔒</Text>
        <View style={styles.premiumChip}>
          <Text style={styles.premiumChipText}>👑 Premium</Text>
        </View>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      <View style={styles.cta}>
        <Text style={styles.ctaText}>{t("upgrade.cta")}</Text>
      </View>
    </View>
  );
}

const makeStyles = (appFonts: AppFonts) => StyleSheet.create({
  card: {
    ...glassCard,
    padding: 22,
    alignItems: "center",
  },
  lockWrap: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  lockEmoji: { fontSize: 26 },
  premiumChip: {
    backgroundColor: "#fef3c7",
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  premiumChipText: { fontSize: 12, color: "#b45309", fontFamily: appFonts.bodySemiBold },
  title: { fontSize: 17, color: colors.text, fontFamily: appFonts.displayBold, textAlign: "center" },
  description: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 19,
    fontFamily: appFonts.body,
  },
  cta: {
    marginTop: 16,
    backgroundColor: colors.primary,
    borderRadius: radius.input,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  ctaText: { color: colors.white, fontSize: 14, fontWeight: "700", fontFamily: appFonts.bodyBold },
});
