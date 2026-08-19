/**
 * RN cover preview card — mirrors the web's CoverPreview (cover gradient,
 * decorations, avatar/initial, "The Soul Journal of", title, year range).
 * Used in the step-2 cover grid and the step-4 book preview.
 * Ported 2026-08-19.
 */
import { useMemo } from "react";
import { View, Text, Image, StyleSheet, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  CoverTemplate, COVER_GRADIENT_COLORS, COVER_TEXT_COLORS, isLightCover, MIDNIGHT_STARS, smartTitleCase,
} from "@/lib/bookTypes";
import { useT } from "@/store/settingsStore";

interface Props {
  cover: CoverTemplate;
  userName: string;
  yearRange: string;
  avatarUrl: string | null;
  showAvatar: boolean;
  /** In-app expo-font family for the title (defaults to serif). */
  titleFont?: string;
  /** Card width; height follows the A5 ratio (3:4.25). */
  width: number;
  radius?: number;
}

export default function CoverPreviewCard({ cover, userName, yearRange, avatarUrl, showAvatar, titleFont, width, radius = 14 }: Props) {
  const t = useT();
  const textColor = COVER_TEXT_COLORS[cover];
  const light = isLightCover(cover);
  const height = Math.round((width * 4.25) / 3);
  const styles = useMemo(() => makeStyles(width, radius), [width, radius]);

  const initials = (userName || "S").trim().charAt(0).toUpperCase();

  const decoration = (() => {
    if (cover === "nebula") {
      return (
        <>
          <View style={[styles.blob, { top: -30, right: -40, width: width * 0.55, height: width * 0.55, backgroundColor: "rgba(255,255,255,0.08)" }]} />
          <View style={[styles.blob, { bottom: -50, left: -40, width: width * 0.75, height: width * 0.75, backgroundColor: "rgba(236,72,153,0.15)" }]} />
        </>
      );
    }
    if (cover === "midnight") {
      return MIDNIGHT_STARS.map((s, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            top: s.top, left: s.left,
            width: s.size * 2.4, height: s.size * 2.4,
            borderRadius: 99,
            backgroundColor: "rgba(255,255,255,0.45)",
          }}
        />
      ));
    }
    if (cover === "botanical") {
      return (
        <>
          <Text style={[styles.decoGlyph, { top: 14, left: 14, fontSize: width * 0.16, color: "rgba(22,163,74,0.15)" }]}>❀</Text>
          <Text style={[styles.decoGlyph, { bottom: 14, right: 14, fontSize: width * 0.12, color: "rgba(22,163,74,0.15)", transform: [{ rotate: "45deg" }] }]}>✿</Text>
          <Text style={[styles.decoGlyph, { top: "25%", right: 12, fontSize: width * 0.1, color: "rgba(22,163,74,0.08)" }]}>🌿</Text>
        </>
      );
    }
    return null;
  })();

  return (
    <LinearGradient colors={COVER_GRADIENT_COLORS[cover]} style={[styles.card, { borderRadius: radius }]} start={{ x: 0, y: 0 }} end={cover === "minimalist" || cover === "midnight" ? { x: 0, y: 1 } : { x: 1, y: 1 }}>
      {decoration}
      <View style={styles.inner}>
        {showAvatar && avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            style={[styles.avatar, { borderColor: light ? "#d6d3d1" : "rgba(255,255,255,0.35)" }]}
          />
        ) : showAvatar ? (
          <View style={[styles.avatar, { backgroundColor: light ? "rgba(41,37,36,0.08)" : "rgba(255,255,255,0.18)", borderColor: light ? "#d6d3d1" : "rgba(255,255,255,0.35)" }]}>
            <Text style={[styles.avatarInitial, { color: textColor, fontFamily: titleFont }]}>{initials}</Text>
          </View>
        ) : null}
        <Text style={[styles.subtitle, { color: textColor, opacity: 0.85 }]} numberOfLines={1}>
          {t("preview.coverSubtitle")}
        </Text>
        <Text
          style={[styles.title, { color: textColor, fontFamily: titleFont, fontStyle: cover === "minimalist" ? "italic" : "normal" }]}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.45}
        >
          {smartTitleCase(userName) || t("preview.soulJournal")}
        </Text>
        <Text style={[styles.year, { color: textColor, opacity: 0.7 }]} numberOfLines={1}>
          {yearRange}
        </Text>
      </View>
    </LinearGradient>
  );
}

const makeStyles = (w: number, radius: number) =>
  StyleSheet.create({
    card: {
      width: w,
      height: Math.round((w * 4.25) / 3),
      overflow: "hidden",
      borderRadius: radius,
    },
    inner: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: w * 0.08,
    },
    avatar: {
      width: w * 0.5,
      height: w * 0.5,
      borderRadius: w * 0.25,
      borderWidth: w * 0.015,
      marginBottom: w * 0.07,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
    },
    avatarInitial: {
      fontSize: w * 0.22,
      fontWeight: "700",
      ...Platform.select({ ios: { marginTop: 2 } }),
    },
    subtitle: {
      fontSize: w * 0.052,
      letterSpacing: 1.6,
      fontWeight: "500",
      textAlign: "center",
    },
    title: {
      fontSize: w * 0.13,
      fontWeight: "700",
      lineHeight: w * 0.14,
      textAlign: "center",
      marginTop: w * 0.04,
    },
    year: {
      fontSize: w * 0.048,
      letterSpacing: 1.4,
      marginTop: w * 0.045,
      textAlign: "center",
    },
    blob: {
      position: "absolute",
      borderRadius: 999,
    },
    decoGlyph: {
      position: "absolute",
    },
  });
