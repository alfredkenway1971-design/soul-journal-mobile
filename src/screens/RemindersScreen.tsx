import { useEffect, useState, useMemo } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Switch, Alert } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { colors, radius, fonts, glassCard, shadows } from "@/theme";
import { useAppFonts, type AppFonts } from "@/hooks/useAppFonts";
import { useT } from "@/store/settingsStore";
import { getReminderPrefs, setReminderPrefs, scheduleReminder, requestNotificationPermission } from "@/lib/notifications";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function RemindersScreen() {
  const navigation = useNavigation();
  const appFonts = useAppFonts();
  const styles = useMemo(() => makeStyles(appFonts), [appFonts]);
  const t = useT();
  const [enabled, setEnabled] = useState(false);
  const [hour, setHour] = useState(20);
  const [minute, setMinute] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const prefs = await getReminderPrefs();
      setEnabled(prefs.enabled);
      setHour(prefs.hour);
      setMinute(prefs.minute);
      setLoaded(true);
    })();
  }, []);

  const toggle = async (value: boolean) => {
    if (value) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert(t("reminders.title"), t("reminders.allowNote"));
        return;
      }
    }
    setEnabled(value);
    const prefs = { enabled: value, hour, minute };
    await setReminderPrefs(prefs);
    await scheduleReminder(prefs);
  };

  const changeTime = async (h: number, m: number) => {
    setHour(h);
    setMinute(m);
    const prefs = { enabled, hour: h, minute: m };
    await setReminderPrefs(prefs);
    if (enabled) await scheduleReminder(prefs);
  };

  if (!loaded) return <LinearGradient colors={[colors.bgTop, colors.bgMid, colors.bgBottom]} style={styles.root} />;

  const timeLabel = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  return (
    <LinearGradient colors={[colors.bgTop, colors.bgMid, colors.bgBottom]} style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.iconBtnText}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>🔔 Rappels</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={[styles.card, shadows.card]}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>{t("reminders.dailyTitle")}</Text>
              <Text style={styles.toggleDesc}>{t("reminders.desc")}</Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={toggle}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>
        </View>

        {enabled && (
          <View style={[styles.card, shadows.card]}>
            <Text style={styles.sectionTitle}>{t("reminders.timeLabel")}</Text>
            <Text style={styles.timeLabel}>{timeLabel}</Text>

            <Text style={styles.pickerLabel}>{t("reminders.hour")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
              {HOURS.map((h) => (
                <Pressable
                  key={h}
                  style={[styles.pill, hour === h && styles.pillActive]}
                  onPress={() => changeTime(h, minute)}
                >
                  <Text style={[styles.pillText, hour === h && { color: colors.white, fontWeight: "700" }]}>
                    {String(h).padStart(2, "0")}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.pickerLabel}>{t("reminders.minute")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
              {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                <Pressable
                  key={m}
                  style={[styles.pill, minute === m && styles.pillActive]}
                  onPress={() => changeTime(hour, m)}
                >
                  <Text style={[styles.pillText, minute === m && { color: colors.white, fontWeight: "700" }]}>
                    {String(m).padStart(2, "0")}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        <Text style={styles.footnote}>
          {t("reminders.fcmNote")}
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
  card: {
    ...glassCard,
    padding: 18,
    marginBottom: 14,
  },
  toggleRow: { flexDirection: "row", alignItems: "center" },
  toggleTitle: { fontSize: 15, color: colors.text, fontFamily: appFonts.bodySemiBold },
  toggleDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2, fontFamily: appFonts.body },
  sectionTitle: { fontSize: 14, color: colors.text, fontFamily: appFonts.bodySemiBold, marginBottom: 4 },
  timeLabel: { fontSize: 34, color: colors.primary, fontFamily: appFonts.displayBold, marginVertical: 6 },
  pickerLabel: { fontSize: 12, color: colors.textMuted, fontFamily: appFonts.bodyMedium, marginTop: 10, marginBottom: 6 },
  pickerRow: { flexDirection: "row", gap: 6 },
  pill: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 6,
  },
  pillActive: { backgroundColor: colors.primary },
  pillText: { fontSize: 13, color: colors.text, fontFamily: appFonts.body },
  footnote: { fontSize: 11, color: colors.textFaint, textAlign: "center", marginTop: 8, lineHeight: 16, fontFamily: appFonts.body },
});
