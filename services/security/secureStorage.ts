import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeModules, Platform } from "react-native";
import type { StateStorage } from "zustand/middleware";

type SecureStorageNativeModule = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

const nativeVault = NativeModules.FlixPlaySecureStorage as
  | SecureStorageNativeModule
  | undefined;

const LEGACY_STORAGE_KEY = "app-storage";

function requireNativeVault(): SecureStorageNativeModule {
  if (nativeVault) return nativeVault;
  throw new Error("Armazenamento seguro indisponível nesta instalação.");
}

async function migrateLegacyValue(key: string): Promise<string | null> {
  const legacy = await AsyncStorage.getItem(key);
  if (legacy === null || !nativeVault) return legacy;

  // Delete plaintext only after the encrypted write has completed.
  await nativeVault.setItem(key, legacy);
  await AsyncStorage.removeItem(key);
  return legacy;
}

/**
 * Zustand storage backed by AndroidKeyStore on native Android.
 * Web keeps AsyncStorage because AndroidKeyStore is not available there.
 */
export const secureStateStorage: StateStorage = {
  async getItem(name) {
    if (Platform.OS !== "android" || (__DEV__ && !nativeVault)) {
      return AsyncStorage.getItem(name);
    }
    const vault = requireNativeVault();
    const secure = await vault.getItem(name);
    if (secure !== null) return secure;
    return migrateLegacyValue(name);
  },

  async setItem(name, value) {
    if (Platform.OS !== "android" || (__DEV__ && !nativeVault)) {
      await AsyncStorage.setItem(name, value);
      return;
    }
    await requireNativeVault().setItem(name, value);
    // Covers installations that wrote again before migration completed.
    await AsyncStorage.removeItem(name);
  },

  async removeItem(name) {
    if (Platform.OS === "android" && (!__DEV__ || nativeVault)) {
      await requireNativeVault().removeItem(name);
    }
    await AsyncStorage.removeItem(name);
  },
};

export async function hasLegacyPlaintextCredentials(): Promise<boolean> {
  return (await AsyncStorage.getItem(LEGACY_STORAGE_KEY)) !== null;
}
