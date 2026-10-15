import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { verifyDeviceEntitlement } from '../src/verify-entitlement';

const deviceId = 'device-123';
const now = 1_800_000_000;
const key = [{ kid: 'k1', publicKey: 'pinned-public-key' }];
const encoder = new TextEncoder();
function b64url(value: object): string {
  const bytes = encoder.encode(JSON.stringify(value));
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let encoded = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2];
    encoded += abc[a >> 2] + abc[((a & 3) << 4) | (b === undefined ? 0 : b >> 4)];
    encoded += b === undefined ? '' : abc[((b & 15) << 2) | (c === undefined ? 0 : c >> 6)];
    encoded += c === undefined ? '' : abc[c & 63];
  }
  return encoded;
}
const claims = {
  iss: 'elvanoq-cloud', aud: 'elvanoq-play', sub: deviceId, deviceId,
  licenseId: 'license-123', iat: now, exp: now + 300,
};
const header = { alg: 'EdDSA', typ: 'JWT', kid: 'k1' };
const dummySig = b64url({}).padEnd(86, 'A').slice(0, 86);
function token(payload = claims, hdr = header) {
  return b64url(hdr) + '.' + b64url(payload) + '.' + dummySig;
}
/** Mock tests policy and callback use, NOT the actual Ed25519 algorithm. */
const acceptSignature = async (publicKey: string, bytes: Uint8Array, signature: Uint8Array) =>
  publicKey === 'pinned-public-key' && bytes.length > 0 && signature.length === 64;

test('valid device-bound claims require a positive verifier callback', async () => {
  assert.deepEqual(await verifyDeviceEntitlement(token(), deviceId, key, acceptSignature, now), claims);
  assert.equal(await verifyDeviceEntitlement(token(), deviceId, key, async () => false, now), null);
});
test('rejects expired, wrong-device, malformed and altered claims', async () => {
  assert.equal(await verifyDeviceEntitlement(token(), deviceId, key, acceptSignature, now + 301), null);
  assert.equal(await verifyDeviceEntitlement(token(), 'different-device', key, acceptSignature, now), null);
  assert.equal(await verifyDeviceEntitlement(token({ ...claims, licenseId: '' }), deviceId, key, acceptSignature, now), null);
  assert.equal(await verifyDeviceEntitlement(token({ ...claims, exp: now + 1800 }), deviceId, key, acceptSignature, now), null);
  assert.equal(await verifyDeviceEntitlement('not.a.jwt', deviceId, key, acceptSignature, now), null);
  assert.equal(await verifyDeviceEntitlement(token(claims, { ...header, kid: 'missing' }), deviceId, key, acceptSignature, now), null);
});
test('rejects signer errors and duplicate kid configuration', async () => {
  assert.equal(await verifyDeviceEntitlement(token(), deviceId, key, async () => { throw Error('unavailable'); }, now), null);
  assert.equal(await verifyDeviceEntitlement(token(), deviceId, [...key, ...key], acceptSignature, now), null);
});
