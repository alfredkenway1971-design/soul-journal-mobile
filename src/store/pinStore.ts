import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

const PIN_KEY = "sj-pin";
const LOCKED_KEY = "sj-locked";

interface PinState {
  hasPin: boolean;
  locked: boolean;
  setPin: (pin: string) => Promise<void>;
  verifyPin: (pin: string) => boolean;
  removePin: () => Promise<void>;
  lock: () => Promise<void>;
  unlock: () => Promise<void>;
  hydrate: () => Promise<void>;
}

let pinHash: string | null = null;

const hash = (pin: string) => {
  // Simple deterministic hash (not for security-critical use; PIN is a convenience lock)
  let h = 5381;
  for (let i = 0; i < pin.length; i++) h = ((h << 5) + h + pin.charCodeAt(i)) | 0;
  return `p${h.toString(36)}${pin.length}`;
};

export const usePinStore = create<PinState>((set, get) => ({
  hasPin: false,
  locked: false,

  setPin: async (pin) => {
    pinHash = hash(pin);
    set({ hasPin: true, locked: false });
    try {
      await AsyncStorage.setItem(PIN_KEY, pinHash);
      await AsyncStorage.setItem(LOCKED_KEY, "false");
    } catch {}
  },

  verifyPin: (pin) => {
    if (!pinHash) return false;
    return pinHash === hash(pin);
  },

  removePin: async () => {
    pinHash = null;
    set({ hasPin: false, locked: false });
    try {
      await AsyncStorage.removeItem(PIN_KEY);
      await AsyncStorage.setItem(LOCKED_KEY, "false");
    } catch {}
  },

  lock: async () => {
    set({ locked: true });
    try { await AsyncStorage.setItem(LOCKED_KEY, "true"); } catch {}
  },

  unlock: async () => {
    set({ locked: false });
    try { await AsyncStorage.setItem(LOCKED_KEY, "false"); } catch {}
  },

  hydrate: async () => {
    try {
      const [rawPin, rawLocked] = await Promise.all([
        AsyncStorage.getItem(PIN_KEY),
        AsyncStorage.getItem(LOCKED_KEY),
      ]);
      pinHash = rawPin;
      set({ hasPin: !!rawPin, locked: rawLocked === "true" });
    } catch {}
  },
}));
