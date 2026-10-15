import { NativeModules, Platform } from 'react-native';

export type LicenseKeyCapability = {
  apiLevel: number;
  platform: string;
  algorithm: string;
  supported: boolean;
  reason: string;
};

export async function inspectLicenseKeyCapability(): Promise<LicenseKeyCapability | null> {
  if (Platform.OS !== 'android') return null;
  const module = NativeModules.ELVANOQLicenseKeyCapability;
  if (!module || typeof module.inspect !== 'function') return null;
  try {
    const result = await module.inspect() as LicenseKeyCapability;
    return result?.supported === false ? result : null;
  } catch {
    return null;
  }
}
