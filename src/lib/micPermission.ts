import { Alert, Linking } from "react-native";
import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync } from "expo-audio";
import { translate, useSettingsStore } from "@/store/settingsStore";

/**
 * Ensure the microphone permission is granted before recording.
 *
 * iOS never re-shows the system dialog once it has been denied/dismissed, so a
 * plain `requestRecordingPermissionsAsync()` returning false used to dead-end
 * on an OK-only alert. This instead re-requests (covers the undetermined/first
 * case), and when the OS still refuses it offers "Open Settings" so the user
 * can flip the toggle (Settings → app → Microphone).
 */
export async function ensureMicPermission(): Promise<boolean> {
  const lang = useSettingsStore.getState().language;
  const t = (key: string) => translate(key, lang);
  try {
    const current = await getRecordingPermissionsAsync();
    if (current.granted) return true;
    const res = await requestRecordingPermissionsAsync();
    if (res.granted) return true;
  } catch {
    // fall through to the settings prompt
  }
  await new Promise<void>((resolve) => {
    Alert.alert(t("mic.blockedTitle"), t("mic.blockedMsg"), [
      { text: t("common.cancel"), style: "cancel", onPress: () => resolve() },
      {
        text: t("mic.openSettings"),
        onPress: () => {
          Linking.openSettings().catch(() => {});
          resolve();
        },
      },
    ]);
  });
  return false;
}
