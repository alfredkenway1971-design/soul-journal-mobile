/**
 * Font Selector — RN port of the web's book-builder FontSelector.
 * Live previews render in the real typeface (all book fonts are loaded at the
 * App root via useFonts). Tabs: All / Modern / Classic / Handwritten.
 * Ported 2026-08-19.
 */
import { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { BOOK_FONTS, BookFont, BookFontConfig } from "@/lib/bookTypes";
import { useT } from "@/store/settingsStore";
import { colors, radius } from "@/theme";

interface Props {
  selected: BookFont;
  onSelect: (f: BookFont) => void;
}

type Cat = "all" | "modern" | "classic" | "handwritten";

const CATS: { id: Cat; label: string }[] = [
  { id: "all", label: "All" },
  { id: "modern", label: "Modern" },
  { id: "classic", label: "Classic" },
  { id: "handwritten", label: "Handwritten" },
];

const PREVIEW_TEXT = "The quick brown fox jumps over the lazy dog.";

export default function FontSelector({ selected, onSelect }: Props) {
  const t = useT();
  const [cat, setCat] = useState<Cat>("all");
  const list = useMemo(() => (cat === "all" ? BOOK_FONTS : BOOK_FONTS.filter((f) => f.category === cat)), [cat]);

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {CATS.map((c) => {
          const active = c.id === cat;
          return (
            <Pressable
              key={c.id}
              onPress={() => setCat(c.id)}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{c.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={{ marginTop: 12 }}>
        {list.map((f) => <FontRow key={f.id} font={f} active={f.id === selected} onPress={() => onSelect(f.id)} />)}
      </View>
    </View>
  );
}

const FontRow = ({ font, active, onPress }: { font: BookFontConfig; active: boolean; onPress: () => void }) => (
  <Pressable onPress={onPress} style={[styles.row, active && styles.rowActive]}>
    <View style={{ flex: 1 }}>
      <Text style={styles.name}>{font.name}</Text>
      <Text style={[styles.preview, { fontFamily: font.appFamily }]} numberOfLines={1}>
        {PREVIEW_TEXT}
      </Text>
    </View>
    <View style={[styles.check, active && styles.checkActive]}>
      {active && <Text style={styles.checkMark}>✓</Text>}
    </View>
  </Pressable>
);

const styles = StyleSheet.create({
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#f5f5f4",
    borderWidth: 1,
    borderColor: "#e7e5e4",
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: 12.5, fontWeight: "600", color: "#78716c" },
  tabTextActive: { color: "#ffffff" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: radius.input,
    borderWidth: 1.5,
    borderColor: "#e7e5e4",
    marginBottom: 8,
    backgroundColor: "#fafaf9",
  },
  rowActive: { borderColor: colors.primary, backgroundColor: "rgba(5,150,105,0.06)" },
  name: { fontSize: 13.5, fontWeight: "700", color: "#292524", marginBottom: 4 },
  preview: { fontSize: 16, color: "#57534e", height: 24 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#d6d3d1",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  checkActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkMark: { color: "#ffffff", fontSize: 13, fontWeight: "800" },
});
