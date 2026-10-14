import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import type { StateStorage } from "zustand/middleware";

export type SecureStorageStatus = "ready" | "failed" | "migration-pending";

const LEGACY_STORAGE_KEY = "app-storage";
const VAULT_TIMEOUT_MS = 2500;
let status: SecureStorageStatus = "migration-pending";
const listeners = new Set<(next: SecureStorageStatus) => void>();

function setStatus(next: SecureStorageStatus) {
  if (status === next) return;
  status = next;
  listeners.forEach((listener) => listener(next));
}

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("secure-storage-timeout")), VAULT_TIMEOUT_MS),
    ),
  ]);
}

function usesNativeVault() {
  return Platform.OS === "android" && !__DEV__;
}

export function getSecureStorageStatus() {
  return status;
}

export function subscribeSecureStorageStatus(listener: (next: SecureStorageStatus) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

async function migrateLegacyValue(key: string): Promise<string | null> {
  const legacy = await AsyncStorage.getItem(key);
  if (legacy === null) {
    setStatus("ready");
    return null;
  }

  setStatus("migration-pending");
  try {
    await withTimeout(SecureStore.setItemAsync(key, legacy));
    const persisted = await withTimeout(SecureStore.getItemAsync(key));
    if (persisted !== legacy) throw new Error("secure-storage-readback-failed");
    await AsyncStorage.removeItem(key);
    setStatus("ready");
    return persisted;
  } catch {
    // Never delete the legacy value until encrypted write/read-back succeeds.
    // Returning it keeps a pre-existing login alive during an upgrade. The
    // next successful secure write migrates it and removes this value.
    setStatus("ready");
    return legacy;
  }
}

/**
 * Android production state is encrypted by Expo SecureStore (Android
 * Keystore). The previous implementation referenced an app-specific native
 * module which was not registered in the generated Expo project, so every
 * production launch reported a storage failure before rehydrating the session.
 */
export const secureStateStorage: StateStorage = {
  async getItem(name) {
    if (!usesNativeVault()) return AsyncStorage.getItem(name);
    try {
      const secure = await withTimeout(SecureStore.getItemAsync(name));
      if (secure !== null) {
        setStatus("ready");
        return secure;
      }
      return migrateLegacyValue(name);
    } catch {
      // A transient Keystore error must not force the recovery screen or erase
      // a still-valid migration source. New logins continue to be written only
      // after SecureStore is available.
      return migrateLegacyValue(name);
    }
  },
  async setItem(name, value) {
    if (!usesNativeVault()) {
      await AsyncStorage.setItem(name, value);
      return;
    }
    try {
      await withTimeout(SecureStore.setItemAsync(name, value));
      await AsyncStorage.removeItem(name);
      setStatus("ready");
    } catch (error) {
      setStatus("failed");
      throw error;
    }
  },
  async removeItem(name) {
    if (usesNativeVault()) {
      try {
        await withTimeout(SecureStore.deleteItemAsync(name));
      } catch {
        setStatus("failed");
      }
    }
    await AsyncStorage.removeItem(name);
  },
};

export async function hasLegacyPlaintextCredentials(): Promise<boolean> {
  return (await AsyncStorage.getItem(LEGACY_STORAGE_KEY)) !== null;
}
