import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../database/prisma.service';
import { generateKeyPairSync, randomBytes, randomUUID, sign } from 'node:crypto';
import { DeviceProofService, proofPayload } from './device-proof.service';
import { sha256 } from './device-auth';

const db = new PrismaService();
const deviceIdRef = { value: '' };
const secret = randomBytes(32).toString('base64url');
const keypair = generateKeyPairSync('ed25519');
const publicKey = keypair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
const service = new DeviceProofService(db);
const auth = 'Bearer ' + secret;

describe('Device proof nonce consumption with PostgreSQL', () => {
  beforeAll(async () => {
    await db.$connect();
    const device = await db.device.create({
      data: { platform: 'ANDROID_TV', publicCode: randomUUID(), deviceKeyHash: sha256(secret) },
    });
    deviceIdRef.value = device.id;
    await service.registerKey(device.id, auth, publicKey);
  });
  afterAll(async () => {
    if (deviceIdRef.value) await db.device.delete({ where: { id: deviceIdRef.value } });
    await db.$disconnect();
  });
  it('accepts one signed challenge and rejects replay, even when submitted concurrently', async () => {
    const id = deviceIdRef.value;
    const { nonce } = await service.challenge(id, auth);
    const signature = sign(null, proofPayload(id, nonce), keypair.privateKey).toString('base64url');
    const results = await Promise.allSettled([
      service.consume(id, auth, nonce, signature),
      service.consume(id, auth, nonce, signature),
    ]);
    expect(results.filter(x => x.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(x => x.status === 'rejected')).toHaveLength(1);
    await expect(service.consume(id, auth, nonce, signature)).rejects.toThrow();
    const stored = await db.deviceProofChallenge.findUnique({ where: { nonceHash: sha256(nonce) } });
    expect(stored?.consumedAt).not.toBeNull();
  });
  it('rejects an invalid signature without consuming a challenge', async () => {
    const id = deviceIdRef.value;
    const { nonce } = await service.challenge(id, auth);
    const wrongKey = generateKeyPairSync('ed25519');
    const signature = sign(null, proofPayload(id, nonce), wrongKey.privateKey).toString('base64url');
    await expect(service.consume(id, auth, nonce, signature)).rejects.toThrow();
    const stored = await db.deviceProofChallenge.findUnique({ where: { nonceHash: sha256(nonce) } });
    expect(stored?.consumedAt).toBeNull();
  });
  it('rejects expired challenges', async () => {
    const id = deviceIdRef.value;
    const { nonce } = await service.challenge(id, auth);
    await db.deviceProofChallenge.update({ where: { nonceHash: sha256(nonce) }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const signature = sign(null, proofPayload(id, nonce), keypair.privateKey).toString('base64url');
    await expect(service.consume(id, auth, nonce, signature)).rejects.toThrow();
  });
});
