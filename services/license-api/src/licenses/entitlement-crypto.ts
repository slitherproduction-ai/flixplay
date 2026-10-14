import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';

export type EntitlementClaims = {
  iss: 'elvanoq-cloud';
  aud: 'elvanoq-play';
  sub: string;
  deviceId: string;
  licenseId: string;
  iat: number;
  exp: number;
};

type VerificationKey = { kid: string; pem: string };
function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

// Key identifiers allow a staged rotation: publish both public keys before switching the signer.
export function issueEntitlement(claims: EntitlementClaims, privateKeyPem: string, kid = 'v1'): string {
  if (!/^[a-zA-Z0-9_-]{1,40}$/.test(kid)) throw new Error('Invalid key identifier');
  const header = encode({ alg: 'EdDSA', typ: 'JWT', kid });
  const payload = encode(claims);
  const signingInput = header + '.' + payload;
  const signature = sign(null, Buffer.from(signingInput), createPrivateKey(privateKeyPem)).toString('base64url');
  return signingInput + '.' + signature;
}

export function verifyEntitlement(
  token: string,
  keys: string | ReadonlyArray<VerificationKey>,
  nowSeconds = Math.floor(Date.now() / 1000),
  expectedDeviceId?: string,
): EntitlementClaims | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || token.length > 4096 || parts.some(x => !/^[A-Za-z0-9_-]+$/.test(x))) return null;
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    if (header.alg !== 'EdDSA' || header.typ !== 'JWT' || typeof header.kid !== 'string') return null;
    const configured = typeof keys === 'string' ? [{ kid: 'v1', pem: keys }] : keys;
    const key = configured.find(item => item.kid === header.kid);
    if (!key) return null;
    if (!verify(null, Buffer.from(parts[0] + '.' + parts[1]), createPublicKey(key.pem), Buffer.from(parts[2], 'base64url'))) return null;
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as EntitlementClaims;
    if (claims.iss !== 'elvanoq-cloud' || claims.aud !== 'elvanoq-play') return null;
    if (!Number.isSafeInteger(claims.iat) || !Number.isSafeInteger(claims.exp) || claims.iat > nowSeconds + 60 || claims.exp <= nowSeconds || claims.exp - claims.iat > 15 * 60) return null;
    if (typeof claims.deviceId !== 'string' || !claims.deviceId || typeof claims.licenseId !== 'string' || !claims.licenseId || claims.sub !== claims.deviceId) return null;
    if (expectedDeviceId && claims.deviceId !== expectedDeviceId) return null;
    return claims;
  } catch {
    return null;
  }
}
