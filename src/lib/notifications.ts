import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { translate, useSettingsStore } from "@/store/settingsStore";

/**
 * Push + local notifications for Soul Journal.
 * Local scheduled reminders work in Expo Go and dev builds; FCM remote push
 * needs a development/production build with google-services.json (Phase 3
 * Firebase setup, documented in the repo reference).
 */

const REMINDER_KEY = "sj-reminder";
const TOKEN_KEY = "sj-push-token";

export interface ReminderPrefs {
  enabled: boolean;
  hour: number; // 0-23
  minute: number;
}

// Android notification channel (required for expo-notifications on Android)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function getReminderPrefs(): Promise<ReminderPrefs> {
  try {
    const raw = await AsyncStorage.getItem(REMINDER_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { enabled: false, hour: 20, minute: 0 };
}

export async function setReminderPrefs(prefs: ReminderPrefs): Promise<void> {
  try {
    await AsyncStorage.setItem(REMINDER_KEY, JSON.stringify(prefs));
  } catch {}
}

/** Ask for notification permission. Returns granted. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!Device.isDevice) {
    // simulator: permissions auto-granted, but scheduling still works
  }
  const settings = await Notifications.getPermissionsAsync();
  let final = settings;
  if (settings.status !== "granted") {
    final = await Notifications.requestPermissionsAsync();
  }
  return final.status === "granted";
}

/** Schedule the daily journaling reminder at the chosen time. */
export async function scheduleReminder(prefs: ReminderPrefs): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!prefs.enabled) return;

  const granted = await requestNotificationPermission();
  if (!granted) return;

  // Repeat daily at hour:minute (local time). Android channel required.
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("daily-reminder", {
      name: "Daily reminder",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
    });
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "✨ Soul Journal",
      body: translate("notif.body", useSettingsStore.getState().language),
      sound: "default",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: prefs.hour,
      minute: prefs.minute,
      channelId: Platform.OS === "android" ? "daily-reminder" : undefined,
    },
  });
}

/** Register for FCM push token (needs a build with google-services.json). */
export async function registerPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null;
  const granted = await requestNotificationPermission();
  if (!granted) return null;
  try {
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    try {
      await AsyncStorage.setItem(TOKEN_KEY, token);
    } catch {}
    return token;
  } catch (e) {
    console.warn("push token error (expected in Expo Go / no FCM config)", e);
    return null;
  }
}

/** Called when the user opens the app from a notification. */
export function setNotificationListener(onTap: (data: any) => void) {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    onTap(response.notification.request.content.data);
  });
}
