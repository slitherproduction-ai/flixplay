import { describe, expect, it } from 'vitest';
import { generateKeyPairSync, sign, verify } from 'node:crypto';
import { proofPayload } from './device-proof.service';

describe('Ed25519 device proof contract', () => {
  it('signs only the correct device and nonce context', () => {
    const keys = generateKeyPairSync('ed25519');
    const nonce = Buffer.alloc(32, 7).toString('base64url');
    const signed = sign(null, proofPayload('device-one', nonce), keys.privateKey);
    expect(verify(null, proofPayload('device-one', nonce), keys.publicKey, signed)).toBe(true);
    expect(verify(null, proofPayload('other', nonce), keys.publicKey, signed)).toBe(false);
  });
});
