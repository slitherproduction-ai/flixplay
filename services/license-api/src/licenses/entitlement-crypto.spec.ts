import { describe, expect, it } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { issueEntitlement, verifyEntitlement } from './entitlement-crypto';

const pair = generateKeyPairSync('ed25519');
const privateKey = pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const publicKey = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
const now = Math.floor(Date.now() / 1000);
const claims = { iss: 'elvanoq-cloud' as const, aud: 'elvanoq-play' as const, sub: 'device', deviceId: 'device', licenseId: 'license', iat: now, exp: now + 300 };

describe('signed entitlements', () => {
  it('signs and verifies a short lived Ed25519 entitlement', () => {
    expect(verifyEntitlement(issueEntitlement(claims, privateKey), publicKey, now)).toEqual(claims);
  });
  it('rejects altered payloads and expired claims', () => {
    const token = issueEntitlement(claims, privateKey);
    const [h, , s] = token.split('.');
    const forged = h + '.' + Buffer.from(JSON.stringify({ ...claims, deviceId: 'other' })).toString('base64url') + '.' + s;
    expect(verifyEntitlement(forged, publicKey, now)).toBeNull();
    expect(verifyEntitlement(token, publicKey, now + 301)).toBeNull();
  });
  it('supports staged rotation and rejects unknown key identifiers', () => {
    const next = generateKeyPairSync('ed25519');
    const nextPrivate = next.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const nextPublic = next.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const token = issueEntitlement(claims, nextPrivate, 'v2');
    expect(verifyEntitlement(token, [{ kid: 'v1', pem: publicKey }, { kid: 'v2', pem: nextPublic }], now, 'device')).toEqual(claims);
    expect(verifyEntitlement(token, [{ kid: 'v1', pem: publicKey }], now)).toBeNull();
    expect(verifyEntitlement(token, [{ kid: 'v2', pem: nextPublic }], now, 'other-device')).toBeNull();
  });
  it('rejects tokens with too long a lifetime', () => {
    expect(verifyEntitlement(issueEntitlement({ ...claims, exp: now + 3600 }, privateKey), publicKey, now)).toBeNull();
  });
});
