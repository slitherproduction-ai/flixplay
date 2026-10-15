import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { DeviceEntitlementService } from './device-entitlement.service';
import { sha256 } from '../devices/device-auth';
import { verifyEntitlement } from './entitlement-crypto';

const pair = generateKeyPairSync('ed25519');
const privateKey = pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const publicKey = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
const deviceSecret = Buffer.alloc(32, 7).toString('base64url');
const device = { id: 'device-one', userId: 'customer-one', deviceKeyHash: sha256(deviceSecret) };
const activeLicense = {
  id: 'license-one', status: 'ACTIVE' as const,
  expiresAt: new Date(Date.now() + 86_400_000),
};

function createService(foundLicense: typeof activeLicense | null = activeLicense) {
  const findUnique = vi.fn().mockResolvedValue(device);
  const findFirst = vi.fn().mockResolvedValue(foundLicense);
  const service = new DeviceEntitlementService({
    device: { findUnique }, license: { findFirst },
  } as any);
  return { service, findUnique, findFirst };
}

describe('device entitlement authorization', () => {
  afterEach(() => {
    delete process.env.ENTITLEMENT_PRIVATE_KEY_PEM;
    delete process.env.ENTITLEMENT_KEY_ID;
  });

  it('requires a matching device credential before querying any license', async () => {
    const { service, findFirst } = createService();
    await expect(service.getEntitlement(device.id, 'Bearer invalid')).rejects.toThrow();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('emits a short signed token bound to the device and license', async () => {
    process.env.ENTITLEMENT_PRIVATE_KEY_PEM = privateKey;
    process.env.ENTITLEMENT_KEY_ID = 'staging-k2';
    const { service, findFirst } = createService();
    const result = await service.getEntitlement(device.id, 'Bearer ' + deviceSecret);
    expect(result.authorized).toBe(true);
    if (!result.authorized) throw new Error('Authorization unexpectedly denied');
    const claims = verifyEntitlement(result.entitlement!, [{ kid: 'staging-k2', pem: publicKey }], undefined, device.id);
    expect(claims?.licenseId).toBe(activeLicense.id);
    expect(claims?.exp! - claims?.iat!).toBeLessThanOrEqual(300);
    expect(verifyEntitlement(result.entitlement!, [{ kid: 'staging-k2', pem: publicKey }], undefined, 'other-device')).toBeNull();
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        deviceId: device.id, userId: device.userId, revokedAt: null,
        status: { in: ['ACTIVE', 'TRIAL', 'GRACE_PERIOD'] },
      }),
    }));
  });

  it('denies a revoked or absent entitlement without issuing a token', async () => {
    process.env.ENTITLEMENT_PRIVATE_KEY_PEM = privateKey;
    const { service } = createService(null);
    await expect(service.getEntitlement(device.id, 'Bearer ' + deviceSecret))
      .resolves.toEqual({ authorized: false, status: 'INACTIVE' });
  });

  it('does not issue an unsigned token when the signer is missing', async () => {
    const { service } = createService();
    await expect(service.getEntitlement(device.id, 'Bearer ' + deviceSecret))
      .rejects.toThrow('Entitlement signing is not configured');
  });
});
