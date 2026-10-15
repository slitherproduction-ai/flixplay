import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { generateKeyPairSync, sign, verify, createPublicKey } from 'node:crypto';
import { verifyDeviceEntitlement } from '../src/verify-entitlement';

const device = 'device-real';
const now = Math.floor(Date.now() / 1000);
const first = generateKeyPairSync('ed25519');
const second = generateKeyPairSync('ed25519');
const publicPem = first.publicKey.export({ type: 'spki', format: 'pem' }).toString();
const secondPublic = second.publicKey.export({ type: 'spki', format: 'pem' }).toString();
const trust = [{ kid: 'v1', publicKey: publicPem }];
const verifyReal = async (pem: string, content: Uint8Array, sig: Uint8Array) =>
  verify(null, Buffer.from(content), createPublicKey(pem), Buffer.from(sig));
const claims = { iss: 'elvanoq-cloud', aud: 'elvanoq-play', sub: device, deviceId: device,
  licenseId: 'license-real', iat: now, exp: now + 300 };
function signed(claimsToSign: object = claims, privateKey = first.privateKey, kid = 'v1'): string {
  const input = Buffer.from(JSON.stringify({ alg: 'EdDSA', typ: 'JWT', kid })).toString('base64url') +
    '.' + Buffer.from(JSON.stringify(claimsToSign)).toString('base64url');
  return input + '.' + sign(null, Buffer.from(input), privateKey).toString('base64url');
}

test('accepts a genuinely Ed25519 signed device entitlement', async () => {
  assert.deepEqual(await verifyDeviceEntitlement(signed(), device, trust, verifyReal, now), claims);
});
test('rejects tampering, mismatched key, and rotation without trusted kid', async () => {
  const valid = signed();
  const pieces = valid.split('.');
  const manipulated = pieces[0] + '.' + Buffer.from(JSON.stringify({ ...claims, licenseId: 'forged' })).toString('base64url') + '.' + pieces[2];
  assert.equal(await verifyDeviceEntitlement(manipulated, device, trust, verifyReal, now), null);
  assert.equal(await verifyDeviceEntitlement(signed(claims, second.privateKey), device, trust, verifyReal, now), null);
  assert.equal(await verifyDeviceEntitlement(signed(claims, second.privateKey, 'v2'), device, trust, verifyReal, now), null);
  assert.deepEqual(await verifyDeviceEntitlement(signed(claims, second.privateKey, 'v2'), device,
    [...trust, { kid: 'v2', publicKey: secondPublic }], verifyReal, now), claims);
});
test('rejects expired token and incorrect device even with valid signature', async () => {
  assert.equal(await verifyDeviceEntitlement(signed(), device, trust, verifyReal, now + 301), null);
  assert.equal(await verifyDeviceEntitlement(signed(), 'other', trust, verifyReal, now), null);
});
