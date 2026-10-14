/** Transport-only license client. Does not turn on any playback enforcement. */
export type DevicePlatform = 'ANDROID' | 'ANDROID_TV' | 'FIRE_TV' | 'TIZEN' | 'WEBOS';
export type DeviceCredentials = { deviceId: string; deviceSecret: string };
export type DeviceEnrollment = DeviceCredentials & { publicCode: string; platform: DevicePlatform };
export type Challenge = { nonce: string; expiresAt: string };
export type EntitlementResult =
  | { authorized: false; status: 'INACTIVE' | 'EXPIRED' }
  | { authorized: true; status: string; expiresAt: string; entitlement: string; tokenExpiresAt: string };
export type ProofSigner = {
  /** Sign proof bytes with a non-exportable device key. Ed25519 raw 64-byte or ECDSA P-256 DER signature. */
  sign(message: Uint8Array): Promise<Uint8Array>;
  /** Return only an SPKI PEM public key; never return the private key. */
  publicKeyPem(): Promise<string>;
};
export type Transport = (url: string, init: RequestInit) => Promise<Response>;

export function proofMessage(deviceId: string, nonce: string): Uint8Array {
  return new TextEncoder().encode('ELVANOQ-ENTITLEMENT-PROOF-V1\n' + deviceId + '\n' + nonce);
}

function base64url(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]; const b = bytes[i + 1]; const c = bytes[i + 2];
    out += alphabet[a >> 2] + alphabet[((a & 3) << 4) | (b === undefined ? 0 : b >> 4)];
    if (b !== undefined) out += alphabet[((b & 15) << 2) | (c === undefined ? 0 : c >> 6)];
    if (c !== undefined) out += alphabet[c & 63];
  }
  return out;
}

export class LicenseClient {
  private readonly baseUrl: string;
  constructor(baseUrl: string, private readonly transport: Transport = fetch) {
    const parsed = new URL(baseUrl);
    if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && parsed.hostname === 'localhost')) {
      throw new Error('License API must use HTTPS');
    }
    this.baseUrl = parsed.href.replace(/\/$/, '');
  }

  private async request<T>(path: string, method: 'GET' | 'POST', secret?: string, body?: unknown): Promise<T> {
    const response = await this.transport(this.baseUrl + path, {
      method,
      headers: { 'Accept': 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(secret ? { 'Authorization': 'Bearer ' + secret } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw new Error('License API request rejected (HTTP ' + response.status + ')');
    return response.json() as Promise<T>;
  }

  async register(platform: DevicePlatform, displayName?: string): Promise<DeviceEnrollment> {
    const payload = await this.request<{ id: string; deviceSecret: string; publicCode: string; platform: DevicePlatform }>(
      '/v1/devices/register', 'POST', undefined, { platform, displayName });
    return { deviceId: payload.id, deviceSecret: payload.deviceSecret, publicCode: payload.publicCode, platform: payload.platform };
  }

  async startPairing(credentials: DeviceCredentials): Promise<{ pairingCode: string; expiresAt: string }> {
    const result = await this.request<{ pairingCode: string; expiresAt: string }>(
      '/v1/devices/' + encodeURIComponent(credentials.deviceId) + '/pairing', 'POST', credentials.deviceSecret);
    if (!/^[0-9]{8}$/.test(result.pairingCode) || !Number.isFinite(Date.parse(result.expiresAt))) {
      throw new Error('Invalid pairing response');
    }
    return result;
  }

  async enrollKey(credentials: DeviceCredentials, signer: ProofSigner): Promise<void> {
    await this.request('/v1/devices/' + encodeURIComponent(credentials.deviceId) + '/proof-key',
      'POST', credentials.deviceSecret, { publicKeyPem: await signer.publicKeyPem() });
  }

  async obtainSignedEntitlement(credentials: DeviceCredentials, signer: ProofSigner): Promise<EntitlementResult> {
    const path = '/v1/devices/' + encodeURIComponent(credentials.deviceId);
    const challenge = await this.request<Challenge>(path + '/challenge', 'POST', credentials.deviceSecret);
    if (!/^[A-Za-z0-9_-]{43}$/.test(challenge.nonce) || Date.parse(challenge.expiresAt) <= Date.now()) {
      throw new Error('Invalid or expired license challenge');
    }
    const signature = await signer.sign(proofMessage(credentials.deviceId, challenge.nonce));
    if (signature.length !== 64 && (signature.length < 68 || signature.length > 80)) throw new Error('Invalid device proof signature length');
    return this.request<EntitlementResult>(path + '/entitlement/proof', 'POST',
      credentials.deviceSecret, { nonce: challenge.nonce, signature: base64url(signature) });
  }
}

/** Deliberately informational. Never block login, playback or browsing based on this value. */
export function observeEntitlement(result: EntitlementResult | null): 'ACTIVE' | 'NOT_ACTIVE' | 'UNKNOWN' {
  if (!result) return 'UNKNOWN';
  return result.authorized ? 'ACTIVE' : 'NOT_ACTIVE';
}
