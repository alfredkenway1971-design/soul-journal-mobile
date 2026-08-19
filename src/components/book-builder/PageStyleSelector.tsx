/**
 * Page Style Selector — RN port of the web's PageStyleSelector.
 * Page Background (blank/lined/dotted), Entry Layout (one-per-page /
 * continuous / magazine / photo-forward), Soul Symbol Watermark toggle.
 * Ported 2026-08-19.
 */
import { View, Text, Pressable, StyleSheet, Switch } from "react-native";
import { PageBackground, EntryLayout, BACKGROUND_ORDER, LAYOUT_ORDER } from "@/lib/bookTypes";
import { useT } from "@/store/settingsStore";
import { colors, radius } from "@/theme";

interface Props {
  background: PageBackground;
  onBackgroundChange: (b: PageBackground) => void;
  layout: EntryLayout;
  onLayoutChange: (l: EntryLayout) => void;
  watermark: boolean;
  onWatermarkChange: (w: boolean) => void;
}

const BG_KEY: Record<PageBackground, string> = { blank: "pageStyle.blank", lined: "pageStyle.lined", dotted: "pageStyle.dotted" };
const LAYOUT_KEY: Record<EntryLayout, string> = {
  "one-per-page": "pageStyle.onePerPage",
  continuous: "pageStyle.continuous",
  magazine: "pageStyle.magazine",
  "photo-forward": "pageStyle.photoForward",
};
const LAYOUT_DESC_KEY: Record<EntryLayout, string> = {
  "one-per-page": "pageStyle.onePerPageDesc",
  continuous: "pageStyle.continuousDesc",
  magazine: "pageStyle.magazineDesc",
  "photo-forward": "pageStyle.photoForwardDesc",
};

/* ── Mini page icons ── */

const BackgroundIcon = ({ bg }: { bg: PageBackground }) => (
  <View style={icons.page}>
    {bg === "lined" && (
      <>
        <View style={icons.line} /><View style={icons.line} /><View style={icons.line} />
      </>
    )}
    {bg === "dotted" && (
      <View style={icons.dotsRow}>
        {[0, 1, 2, 3, 4].map((i) => <View key={i} style={icons.dotsCol}>{[0, 1, 2].map((j) => <View key={j} style={icons.dot} />)}</View>)}
      </View>
    )}
  </View>
);

const LayoutIcon = ({ layout }: { layout: EntryLayout }) => {
  if (layout === "one-per-page") {
    return <View style={[icons.page, icons.onePage]}><View style={icons.oneTitle} /><View style={icons.oneLine} /><View style={[icons.oneLine, { width: "60%" }]} /></View>;
  }
  if (layout === "continuous") {
    return (
      <View style={icons.contWrap}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[icons.contPage, i === 1 && icons.contMid]}>
            <View style={icons.contLine} />
          </View>
        ))}
      </View>
    );
  }
  if (layout === "magazine") {
    return (
      <View style={[icons.page, icons.onePage]}>
        <View style={icons.magCols}>
          <Text style={icons.magDrop}>A</Text>
          <View style={icons.magCol}><View style={[icons.oneLine, { width: "100%" }]} /><View style={[icons.oneLine, { width: "100%" }]} /><View style={[icons.oneLine, { width: "80%" }]} /></View>
        </View>
      </View>
    );
  }
  return (
    <View style={[icons.page, icons.onePage]}>
      <View style={icons.photoHero} />
      <View style={[icons.oneLine, { width: "70%", marginTop: 4 }]} />
      <View style={[icons.oneLine, { width: "90%" }]} />
    </View>
  );
};

export default function PageStyleSelector({ background, onBackgroundChange, layout, onLayoutChange, watermark, onWatermarkChange }: Props) {
  const t = useT();

  return (
    <View style={styles.wrap}>
      {/* Page Background */}
      <Text style={styles.label}>{t("pageStyle.pageBackground")}</Text>
      <View style={styles.row3}>
        {BACKGROUND_ORDER.map((bg) => {
          const active = bg === background;
          return (
            <Pressable
              key={bg}
              onPress={() => onBackgroundChange(bg)}
              style={[styles.iconCard, active && styles.iconCardActive]}
            >
              <BackgroundIcon bg={bg} />
              <Text style={[styles.iconLabel, active && styles.iconLabelActive]}>{t(BG_KEY[bg])}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Entry Layout */}
      <Text style={[styles.label, { marginTop: 18 }]}>{t("pageStyle.entryLayout")}</Text>
      <View style={styles.grid2}>
        {LAYOUT_ORDER.map((l) => {
          const active = l === layout;
          return (
            <Pressable
              key={l}
              onPress={() => onLayoutChange(l)}
              style={[styles.layoutCard, active && styles.iconCardActive]}
            >
              <LayoutIcon layout={l} />
              <Text style={[styles.layoutName, active && styles.iconLabelActive]}>{t(LAYOUT_KEY[l])}</Text>
              <Text style={[styles.layoutDesc, active && { color: colors.primary }]} numberOfLines={2}>
                {t(LAYOUT_DESC_KEY[l])}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Watermark */}
      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>{t("pageStyle.watermark")}</Text>
          <Text style={styles.switchDesc}>{t("pageStyle.watermarkDesc")}</Text>
        </View>
        <Switch value={watermark} onValueChange={onWatermarkChange} trackColor={{ true: colors.primary, false: "#d6d3d1" }} thumbColor="#ffffff" />
      </View>
    </View>
  );
}

const icons = StyleSheet.create({
  page: {
    width: 30,
    height: 38,
    borderRadius: 4,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d6d3d1",
    padding: 5,
    justifyContent: "flex-start",
  },
  onePage: { width: 44, height: 52 },
  line: {
    height: 2.5,
    borderRadius: 2,
    backgroundColor: "#bfdbfe",
    marginBottom: 5,
    width: "100%",
  },
  dotsRow: { flexDirection: "row", justifyContent: "space-between" },
  dotsCol: { justifyContent: "space-between" },
  dot: { width: 2.5, height: 2.5, borderRadius: 2, backgroundColor: "#a8a29e", marginBottom: 5 },
  oneTitle: { width: "70%", height: 4, borderRadius: 2, backgroundColor: "#e7e5e4", marginBottom: 5 },
  oneLine: { width: "100%", height: 3, borderRadius: 2, backgroundColor: "#e7e5e4", marginBottom: 4 },
  contWrap: { width: 44, height: 52, flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 3 },
  contPage: { width: 14, height: 30, borderRadius: 2, borderWidth: 1, borderColor: "#d6d3d1", backgroundColor: "#fff", padding: 2 },
  contMid: { height: 40 },
  contLine: { height: 2, backgroundColor: "#e7e5e4", borderRadius: 1, marginTop: 3 },
  magCols: { flexDirection: "row", gap: 4, paddingTop: 3 },
  magDrop: { fontSize: 15, fontWeight: "800", color: "#0a0a0a", lineHeight: 16 },
  magCol: { flex: 1 },
  photoHero: { width: "100%", height: 18, borderRadius: 2, backgroundColor: "#fed7aa", marginBottom: 5 },
});

const styles = StyleSheet.create({
  wrap: { marginTop: 20 },
  label: { fontSize: 14, fontWeight: "600", color: "#1c1917", marginBottom: 10 },
  row3: { flexDirection: "row", gap: 10 },
  iconCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: radius.input,
    borderWidth: 1.5,
    borderColor: "#e7e5e4",
    backgroundColor: "#fafaf9",
    gap: 8,
  },
  iconCardActive: { borderColor: colors.primary, backgroundColor: "rgba(5,150,105,0.06)" },
  iconLabel: { fontSize: 12, fontWeight: "600", color: "#78716c" },
  iconLabelActive: { color: colors.primary },
  grid2: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  layoutCard: {
    width: "48%",
    flexGrow: 1,
    padding: 12,
    borderRadius: radius.input,
    borderWidth: 1.5,
    borderColor: "#e7e5e4",
    backgroundColor: "#fafaf9",
    gap: 4,
  },
  layoutName: { fontSize: 13, fontWeight: "700", color: "#292524", marginTop: 6 },
  layoutDesc: { fontSize: 11, color: "#a8a29e", lineHeight: 15 },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 18,
    padding: 14,
    borderRadius: radius.input,
    borderWidth: 1.5,
    borderColor: "#e7e5e4",
    backgroundColor: "#fafaf9",
  },
  switchDesc: { fontSize: 11.5, color: "#a8a29e", marginTop: 2 },
});
