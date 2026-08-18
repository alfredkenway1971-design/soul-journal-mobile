import { useState, useMemo } from "react";
import { View, Text, Pressable, StyleSheet, Alert } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, radius, fonts } from "@/theme";
import { useAppFonts, type AppFonts } from "@/hooks/useAppFonts";
import { usePinStore } from "@/store/pinStore";

/** Full-screen lock shown at app open when a PIN is set. */
export default function PinLockScreen() {
  const { verifyPin, unlock } = usePinStore();
  const appFonts = useAppFonts();
  const styles = useMemo(() => makeStyles(appFonts), [appFonts]);
  const [entry, setEntry] = useState("");

  const press = (d: string) => {
    if (entry.length >= 8) return;
    const next = entry + d;
    setEntry(next);
    if (next.length >= 4 && verifyPin(next)) {
      unlock();
    } else if (next.length >= 4) {
      Alert.alert("Code incorrect", "Réessayez.");
      setEntry("");
    }
  };

  const backspace = () => setEntry((e) => e.slice(0, -1));

  return (
    <LinearGradient colors={[colors.bgTop, colors.bgMid, colors.bgBottom]} style={styles.root}>
      <View style={styles.center}>
        <Text style={styles.lockEmoji}>🔐</Text>
        <Text style={styles.title}>Soul Journal</Text>
        <Text style={styles.subtitle}>Entrez votre code PIN</Text>

        <View style={styles.dots}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <View key={i} style={[styles.dot, i < entry.length && styles.dotFilled]} />
          ))}
        </View>

        <View style={styles.pad}>
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((k, i) =>
            k === "" ? (
              <View key={i} style={styles.key} />
            ) : (
              <Pressable
                key={i}
                style={styles.key}
                onPress={() => (k === "⌫" ? backspace() : press(k))}
              >
                <Text style={styles.keyText}>{k}</Text>
              </Pressable>
            )
          )}
        </View>
      </View>
    </LinearGradient>
  );
}

const makeStyles = (appFonts: AppFonts) => StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  lockEmoji: { fontSize: 44, marginBottom: 10 },
  title: { fontSize: 26, color: colors.text, fontFamily: appFonts.displayBold },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 6, fontFamily: appFonts.body },
  dots: { flexDirection: "row", gap: 12, marginTop: 28, marginBottom: 32 },
  dot: { width: 16, height: 16, borderRadius: 999, backgroundColor: colors.glassBorder },
  dotFilled: { backgroundColor: colors.primary },
  pad: { flexDirection: "row", flexWrap: "wrap", width: 270, justifyContent: "center" },
  key: {
    width: 78,
    height: 78,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    margin: 6,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  keyText: { fontSize: 24, color: colors.text, fontFamily: appFonts.bodyMedium },
});
