import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * v5.0 usage counters (mobile, local parity with web localStorage):
 *  - Voice replays (cloned-voice playback): 0 free / 20 per month Premium,
 *    + purchased credits (voice_credits from check-subscription).
 *  - Soul Book PDF exports: 1 free / 3 per month Premium.
 * Counters reset automatically each calendar month via the key suffix.
 */

const REPLAY_KEY_PREFIX = "sj-voice-replays";

function monthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function getReplaysUsed(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(`${REPLAY_KEY_PREFIX}-${monthKey()}`);
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export async function incrementReplaysUsed(): Promise<number> {
  const next = (await getReplaysUsed()) + 1;
  try {
    await AsyncStorage.setItem(`${REPLAY_KEY_PREFIX}-${monthKey()}`, String(next));
  } catch {}
  return next;
}
