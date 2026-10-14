import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { generateKeyPairSync, randomBytes, randomUUID, sign } from 'node:crypto';
import { DeviceProofService, proofPayload } from './device-proof.service';
import { sha256 } from './device-auth';
import { PrismaService } from '../database/prisma.service';

const db = new PrismaService();
const service = new DeviceProofService(db);
const secret = randomBytes(32).toString('base64url');
const auth = 'Bearer ' + secret;
const keys = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const publicKey = keys.publicKey.export({ type: 'spki', format: 'pem' }).toString();
let deviceId: string;

describe('P-256 device proof on PostgreSQL', () => {
  beforeAll(async () => {
    await db.$connect();
    const device = await db.device.create({
      data: { platform: 'ANDROID_TV', publicCode: randomUUID(), deviceKeyHash: sha256(secret) },
    });
    deviceId = device.id;
    await service.registerKey(deviceId, auth, publicKey);
  });
  afterAll(async () => {
    if (deviceId) await db.device.delete({ where: { id: deviceId } });
    await db.$disconnect();
  });
  it('stores strict P-256 algorithm and accepts only one signed nonce', async () => {
    const device = await db.device.findUniqueOrThrow({ where: { id: deviceId } });
    expect(device.proofAlgorithm).toBe('ES256');
    const { nonce } = await service.challenge(deviceId, auth);
    const signature = sign('sha256', proofPayload(deviceId, nonce), keys.privateKey).toString('base64url');
    const results = await Promise.allSettled([
      service.consume(deviceId, auth, nonce, signature),
      service.consume(deviceId, auth, nonce, signature),
    ]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(1);
  });
  it('rejects signatures from another P-256 private key', async () => {
    const { nonce } = await service.challenge(deviceId, auth);
    const other = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const signature = sign('sha256', proofPayload(deviceId, nonce), other.privateKey).toString('base64url');
    await expect(service.consume(deviceId, auth, nonce, signature)).rejects.toThrow();
  });
});
