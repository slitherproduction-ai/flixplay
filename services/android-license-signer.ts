import { NativeModules, Platform } from 'react-native';
import type { ProofSigner } from '../packages/elvanoq-license-client/src';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function toBase64(data: Uint8Array): string {
  let result = '';
  for (let i = 0; i < data.length; i += 3) {
    const a = data[i];
    const second = data[i + 1];
    const third = data[i + 2];
    result += ALPHABET[a >> 2] + ALPHABET[((a & 3) << 4) | (second === undefined ? 0 : second >> 4)];
    result += second === undefined ? '=' : ALPHABET[((second & 15) << 2) | (third === undefined ? 0 : third >> 6)];
    result += third === undefined ? '=' : ALPHABET[third & 63];
  }
  return result;
}

function fromBase64(input: string): Uint8Array {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(input) || input.length % 4 !== 0) throw new Error('Invalid native signature encoding');
  const bytes: number[] = [];
  for (let i = 0; i < input.length; i += 4) {
    const a = ALPHABET.indexOf(input[i]), b = ALPHABET.indexOf(input[i + 1]);
    const c = input[i + 2] === '=' ? 0 : ALPHABET.indexOf(input[i + 2]);
    const d = input[i + 3] === '=' ? 0 : ALPHABET.indexOf(input[i + 3]);
    bytes.push((a << 2) | (b >> 4));
    if (input[i + 2] !== '=') bytes.push(((b & 15) << 4) | (c >> 2));
    if (input[i + 3] !== '=') bytes.push(((c & 3) << 6) | d);
  }
  return Uint8Array.from(bytes);
}

function signerBridge() {
  if (Platform.OS !== 'android') throw new Error('Android required');
  const bridge = NativeModules.ELVANOQLicenseKeyCapability;
  if (!bridge || typeof bridge.sign !== 'function' || typeof bridge.publicKeyPem !== 'function') {
    throw new Error('Native key bridge unavailable');
  }
  return bridge;
}

export async function enrollAndroidLicenseKey(): Promise<string> {
  const bridge = signerBridge();
  return bridge.enroll();
}

export function androidLicenseSigner(): ProofSigner {
  const bridge = signerBridge();
  return {
    publicKeyPem: () => bridge.publicKeyPem(),
    sign: async (bytes) => {
      const signature = fromBase64(await bridge.sign(toBase64(bytes)));
      if (signature.length < 68 || signature.length > 80) throw new Error('Invalid DER signature length');
      return signature;
    },
  };
}
