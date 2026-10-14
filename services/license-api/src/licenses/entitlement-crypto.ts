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

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function issueEntitlement(claims: EntitlementClaims, privateKeyPem: string): string {
  const header = encode({ alg: 'EdDSA', typ: 'JWT' });
  const payload = encode(claims);
  const signingInput = header + '.' + payload;
  const signature = sign(null, Buffer.from(signingInput), createPrivateKey(privateKeyPem)).toString('base64url');
  return signingInput + '.' + signature;
}

export function verifyEntitlement(token: string, publicKeyPem: string, nowSeconds = Math.floor(Date.now() / 1000)): EntitlementClaims | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || parts.some(x => !/^[A-Za-z0-9_-]+$/.test(x))) return null;
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    if (header.alg !== 'EdDSA' || header.typ !== 'JWT') return null;
    const valid = verify(null, Buffer.from(parts[0] + '.' + parts[1]), createPublicKey(publicKeyPem), Buffer.from(parts[2], 'base64url'));
    if (!valid) return null;
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as EntitlementClaims;
    if (claims.iss !== 'elvanoq-cloud' || claims.aud !== 'elvanoq-play') return null;
    if (!Number.isSafeInteger(claims.iat) || !Number.isSafeInteger(claims.exp) || claims.iat > nowSeconds + 60 || claims.exp <= nowSeconds || claims.exp - claims.iat > 15 * 60) return null;
    if (!claims.deviceId || !claims.licenseId || claims.sub !== claims.deviceId) return null;
    return claims;
  } catch {
    return null;
  }
}
