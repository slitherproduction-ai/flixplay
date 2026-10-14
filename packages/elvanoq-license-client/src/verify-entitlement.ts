/** Strict entitlement policy; cryptographic verifier must be provided by a trusted native implementation. */
export type TrustedEntitlementKey = { kid: string; publicKey: string };
export type VerifyEd25519 = (publicKey: string, payload: Uint8Array, signature: Uint8Array) => Promise<boolean>;
export type VerifiedEntitlement = {
  iss: 'elvanoq-cloud'; aud: 'elvanoq-play'; sub: string; deviceId: string; licenseId: string; iat: number; exp: number;
};

function decodeBase64Url(part: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(part) || part.length % 4 === 1) return null;
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const bytes: number[] = [];
  for (let i = 0; i < part.length; i += 4) {
    const a = abc.indexOf(part[i]), b = abc.indexOf(part[i + 1]);
    const c = i + 2 < part.length ? abc.indexOf(part[i + 2]) : 0;
    const d = i + 3 < part.length ? abc.indexOf(part[i + 3]) : 0;
    if (a < 0 || b < 0 || c < 0 || d < 0) return null;
    bytes.push((a << 2) | (b >> 4));
    if (i + 2 < part.length) bytes.push(((b & 15) << 4) | (c >> 2));
    if (i + 3 < part.length) bytes.push(((c & 3) << 6) | d);
  }
  return Uint8Array.from(bytes);
}

function decodeJson(bytes: Uint8Array): Record<string, unknown> | null {
  try {
    const data: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    return data && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : null;
  } catch { return null; }
}

/**
 * Fail closed. No default verifier and no network-loaded key; pinned trusted keys only.
 * Returns claims only after a real Ed25519 signature check.
 */
export async function verifyDeviceEntitlement(
  token: string,
  deviceId: string,
  trustedKeys: ReadonlyArray<TrustedEntitlementKey>,
  verify: VerifyEd25519,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<VerifiedEntitlement | null> {
  if (typeof token !== 'string' || token.length > 4096 || !deviceId || !trustedKeys.length) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [protectedHeader, payloadText, signatureText] = parts;
  const h = decodeBase64Url(protectedHeader), p = decodeBase64Url(payloadText), signature = decodeBase64Url(signatureText);
  if (!h || !p || !signature || signature.length !== 64) return null;
  const header = decodeJson(h), claims = decodeJson(p);
  if (!header || !claims || header.alg !== 'EdDSA' || header.typ !== 'JWT' || typeof header.kid !== 'string') return null;
  const keys = trustedKeys.filter(k => k.kid === header.kid);
  if (keys.length !== 1) return null;
  const { iss, aud, sub, deviceId: boundDeviceId, licenseId, iat, exp } = claims;
  if (iss !== 'elvanoq-cloud' || aud !== 'elvanoq-play' || sub !== deviceId || boundDeviceId !== deviceId ||
      typeof licenseId !== 'string' || !licenseId || typeof iat !== 'number' || typeof exp !== 'number' ||
      !Number.isSafeInteger(iat) || !Number.isSafeInteger(exp) ||
      iat > nowSeconds + 60 || exp <= nowSeconds || exp <= iat || exp - iat > 900) return null;
  const input = new TextEncoder().encode(protectedHeader + '.' + payloadText);
  try {
    if (!(await verify(keys[0].publicKey, input, signature))) return null;
    return { iss: 'elvanoq-cloud', aud: 'elvanoq-play', sub: deviceId,
      deviceId, licenseId, iat, exp };
  } catch { return null; }
}
