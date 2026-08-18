import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors, fonts } from "@/theme";

const CACHE_KEY = "sj-weather-badge-v1";
const CACHE_TTL_MS = 1000 * 60 * 30; // 30 min (same as web)

interface WeatherInfo {
  city: string;
  temperature_c: number | null;
  condition: string;
  icon: string;
}

const wmoToCondition = (code: number): { condition: string; icon: string } => {
  if (code === 0) return { condition: "Clear", icon: "☀️" };
  if ([1, 2].includes(code)) return { condition: "Mostly clear", icon: "🌤️" };
  if (code === 3) return { condition: "Cloudy", icon: "☁️" };
  if ([45, 48].includes(code)) return { condition: "Foggy", icon: "🌫️" };
  if ([51, 53, 55, 56, 57].includes(code)) return { condition: "Drizzle", icon: "🌦️" };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { condition: "Rainy", icon: "🌧️" };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { condition: "Snowy", icon: "❄️" };
  if ([95, 96, 99].includes(code)) return { condition: "Storm", icon: "⛈️" };
  return { condition: "—", icon: "🌡️" };
};

/** Mobile WeatherBadge — mirrors the web component (geolocation -> open-meteo + nominatim, 30 min cache). */
export default function WeatherBadge() {
  const [info, setInfo] = useState<WeatherInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        // Cache check
        const raw = await AsyncStorage.getItem(CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Date.now() - parsed.t < CACHE_TTL_MS) {
            if (!cancelled) setInfo(parsed.data);
            return;
          }
        }
        const perm = await Location.requestForegroundPermissionsAsync();
        if (!perm.granted) return;
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const { latitude: lat, longitude: lon } = pos.coords;

        const [wRes, gRes] = await Promise.all([
          fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`
          ),
          fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`,
            { headers: { Accept: "application/json" } }
          ),
        ]);
        const wJson = await wRes.json().catch(() => null);
        const gJson = await gRes.json().catch(() => null);
        const code = wJson?.current?.weather_code ?? 0;
        const meta = wmoToCondition(code);
        const a = gJson?.address || {};
        const city = a.city || a.town || a.village || a.hamlet || a.municipality || a.state || "Your area";
        const data: WeatherInfo = {
          city,
          temperature_c: typeof wJson?.current?.temperature_2m === "number" ? Math.round(wJson.current.temperature_2m) : null,
          condition: meta.condition,
          icon: meta.icon,
        };
        if (!cancelled) setInfo(data);
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), data }));
      } catch {
        /* silent — no weather, no crash */
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!info) return null;

  return (
    <View style={styles.row}>
      <Ionicons name="location-outline" size={12} color={colors.textMuted} />
      <Text style={styles.text} numberOfLines={1}>{info.city}</Text>
      <Text style={styles.dot}>•</Text>
      <Text style={styles.text}>{info.icon}</Text>
      {info.temperature_c !== null && <Text style={styles.text}>{info.temperature_c}°C</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  text: { fontSize: 12, color: colors.textMuted, fontFamily: fonts.body },
  dot: { fontSize: 12, color: colors.textMuted },
});
