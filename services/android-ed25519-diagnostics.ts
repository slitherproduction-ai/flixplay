import { NativeModules, Platform } from 'react-native';

export type Ed25519ProviderReport = {
  apiLevel: number;
  algorithm: 'Ed25519';
  supported: boolean;
  reason: string;
};

/** Diagnostic only. Native provider detection does not prove full Fire TV compatibility. */
export async function inspectEd25519Provider(): Promise<Ed25519ProviderReport | null> {
  if (Platform.OS !== 'android') return null;
  const native = NativeModules.ELVANOQLicenseKeyCapability;
  if (!native || typeof native.inspectEd25519Verifier !== 'function') return null;
  try {
    const report = await native.inspectEd25519Verifier() as Ed25519ProviderReport;
    if (report?.algorithm !== 'Ed25519' || typeof report.supported !== 'boolean') return null;
    return report;
  } catch {
    return null;
  }
}
