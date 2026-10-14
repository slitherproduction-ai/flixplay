import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { LicenseClient, type DeviceCredentials, type ProofSigner, type EntitlementResult } from '../packages/elvanoq-license-client/src';

/** Staging-only observer; explicit opt-in. It never changes playback, sign-in or navigation. */
export const LICENSE_OBSERVER_ENABLED = process.env.EXPO_PUBLIC_ELVANOQ_LICENSE_OBSERVER === 'true';
const CREDENTIAL_KEY = 'elvanoq.cloud.device.v1';
export type ObserverState = 'DISABLED' | 'NOT_ENROLLED' | 'NOT_CONFIGURED' | 'ACTIVE' | 'INACTIVE' | 'UNAVAILABLE';

export async function loadDeviceCredentials(): Promise<DeviceCredentials | null> {
  if (Platform.OS !== 'android') return null;
  try {
    const serialized = await SecureStore.getItemAsync(CREDENTIAL_KEY);
    if (!serialized) return null;
    const data: unknown = JSON.parse(serialized);
    if (!data || typeof data !== 'object') return null;
    const record = data as Record<string, unknown>;
    if (typeof record.deviceId !== 'string' || typeof record.deviceSecret !== 'string') return null;
    return { deviceId: record.deviceId, deviceSecret: record.deviceSecret };
  } catch {
    return null;
  }
}

/** Only call after explicit opt-in and an authenticated, verified registration flow. */
export async function storeDeviceCredentials(credentials: DeviceCredentials): Promise<void> {
  if (Platform.OS !== 'android') throw new Error('Android secure storage required');
  await SecureStore.setItemAsync(CREDENTIAL_KEY, JSON.stringify(credentials));
}

export async function observeLicense(signer?: ProofSigner): Promise<ObserverState> {
  if (!LICENSE_OBSERVER_ENABLED) return 'DISABLED';
  if (Platform.OS !== 'android') return 'UNAVAILABLE';
  const apiUrl = process.env.EXPO_PUBLIC_ELVANOQ_LICENSE_API_URL;
  if (!apiUrl) return 'NOT_CONFIGURED';
  const credentials = await loadDeviceCredentials();
  if (!credentials) return 'NOT_ENROLLED';
  // A proper Android Keystore signing adapter is required; do not downgrade to bearer-only.
  if (!signer) return 'NOT_CONFIGURED';
  try {
    const client = new LicenseClient(apiUrl);
    const result: EntitlementResult = await client.obtainSignedEntitlement(credentials, signer);
    // Informational telemetry only. A trusted-key JWT verifier is still required for enforcement.
    return result.authorized ? 'ACTIVE' : 'INACTIVE';
  } catch {
    return 'UNAVAILABLE';
  }
}
