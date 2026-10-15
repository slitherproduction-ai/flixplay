import { NativeModules, Platform } from 'react-native';
import type { VerifyEd25519 } from '../packages/elvanoq-license-client/src/verify-entitlement';

const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function base64(data: Uint8Array): string {
  let output = '';
  for (let i = 0; i < data.length; i += 3) {
    const a = data[i], b = data[i + 1], c = data[i + 2];
    output += abc[a >> 2] + abc[((a & 3) << 4) | (b === undefined ? 0 : b >> 4)];
    output += b === undefined ? '=' : abc[((b & 15) << 2) | (c === undefined ? 0 : c >> 6)];
    output += c === undefined ? '=' : abc[c & 63];
  }
  return output;
}

/** Verification fails closed if a device has no Ed25519 platform crypto provider. */
export const verifyNativeEd25519: VerifyEd25519 = async (pem, input, signature) => {
  if (Platform.OS !== 'android' || signature.length !== 64 || input.length > 4096) return false;
  const native = NativeModules.ELVANOQLicenseKeyCapability;
  if (!native || typeof native.verifyEd25519 !== 'function') return false;
  try {
    return (await native.verifyEd25519(pem, base64(input), base64(signature))) === true;
  } catch {
    return false;
  }
};
