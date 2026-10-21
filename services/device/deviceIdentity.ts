import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const DEVICE_IDENTITY_KEY = "elvanoq-device-identity-v1";

export type DeviceIdentity = {
  /** Registration identifier formatted for support and device activation. */
  macAddress: string;
  /** Short device key displayed alongside the registration identifier. */
  deviceKey: string;
};

function randomByte(): number {
  return Math.floor(Math.random() * 256);
}

function createIdentity(): DeviceIdentity {
  // Android does not expose the physical Wi-Fi MAC address to normal apps.
  // A private, installation-scoped identifier avoids tracking hardware while
  // preserving the familiar MAC format used by activation/support workflows.
  const bytes = [0x02, randomByte(), randomByte(), randomByte(), randomByte(), randomByte()];
  const macAddress = bytes.map((value) => value.toString(16).padStart(2, "0")).join(":").toUpperCase();
  const deviceKey = String(Math.floor(100000 + Math.random() * 900000));
  return { macAddress, deviceKey };
}

async function readStoredIdentity(): Promise<string | null> {
  if (Platform.OS === "android" && !__DEV__) {
    try {
      return await SecureStore.getItemAsync(DEVICE_IDENTITY_KEY);
    } catch {
      // The non-sensitive display identifier may safely fall back to the
      // app sandbox if a device's Keystore is temporarily unavailable.
    }
  }
  return AsyncStorage.getItem(DEVICE_IDENTITY_KEY);
}

async function writeStoredIdentity(value: string): Promise<void> {
  if (Platform.OS === "android" && !__DEV__) {
    try {
      await SecureStore.setItemAsync(DEVICE_IDENTITY_KEY, value);
      return;
    } catch {
      // Keep the login usable on devices with a transient Keystore failure.
    }
  }
  await AsyncStorage.setItem(DEVICE_IDENTITY_KEY, value);
}

/** Gets or creates the local device registration identity. No network call is made. */
export async function getDeviceIdentity(): Promise<DeviceIdentity> {
  const stored = await readStoredIdentity();
  if (stored) {
    try {
      const identity = JSON.parse(stored) as Partial<DeviceIdentity>;
      if (typeof identity.macAddress === "string" && typeof identity.deviceKey === "string") {
        return { macAddress: identity.macAddress, deviceKey: identity.deviceKey };
      }
    } catch {
      // Replace only an invalid local record; no account data is affected.
    }
  }
  const identity = createIdentity();
  await writeStoredIdentity(JSON.stringify(identity));
  return identity;
}
