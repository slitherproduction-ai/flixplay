import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AdminLicensesService } from './admin-licenses.service';

const database = new PrismaClient();
const unique = randomUUID();
const planCode = 'ELVANOQ_ANNUAL_2490';
let customerId: string;
let adminId: string;
let deviceId: string;
let planId: string;
let createdPlan = false;

describe('License lifecycle on PostgreSQL', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.LICENSE_ADMIN_WRITES_ENABLED = 'true';
    await database.$connect();
    const admin = await database.user.create({ data: { email: 'admin-' + unique + '@example.invalid', passwordHash: 'test-only', role: 'ADMIN' } });
    const customer = await database.user.create({ data: { email: 'client-' + unique + '@example.invalid', passwordHash: 'test-only' } });
    adminId = admin.id;
    customerId = customer.id;
    const plan = await database.plan.findUnique({ where: { code: planCode } });
    if (plan) {
      planId = plan.id;
    } else {
      const result = await database.plan.create({ data: { code: planCode, name: 'ELVANOQ Anual', priceCents: 2490, currency: 'BRL', durationDays: 365 } });
      planId = result.id;
      createdPlan = true;
    }
    const device = await database.device.create({
      data: { userId: customerId, platform: 'ANDROID_TV', publicCode: unique, deviceKeyHash: unique },
    });
    deviceId = device.id;
  });

  afterAll(async () => {
    if (deviceId) {
      await database.auditLog.deleteMany({ where: { subjectType: 'license', action: { startsWith: 'license.test_' } } });
      await database.license.deleteMany({ where: { deviceId } });
      await database.device.delete({ where: { id: deviceId } });
    }
    if (customerId) await database.user.delete({ where: { id: customerId } });
    if (adminId) await database.user.delete({ where: { id: adminId } });
    if (createdPlan && planId) await database.plan.delete({ where: { id: planId } });
    await database.$disconnect();
    delete process.env.LICENSE_ADMIN_WRITES_ENABLED;
  });

  const adminAuth = { authenticate: vi.fn().mockImplementation(async () => adminId) };
  const service = new AdminLicensesService(database as any, adminAuth as any);

  it('issues only one active license under concurrent requests, then renews and revokes', async () => {
    const attempts = await Promise.allSettled([service.issue('Bearer fake', deviceId), service.issue('Bearer fake', deviceId)]);
    expect(attempts.filter(x => x.status === 'fulfilled'), JSON.stringify(attempts.filter(x => x.status === 'rejected').map(x => String(x.reason)))).toHaveLength(1);
    expect(attempts.filter(x => x.status === 'rejected')).toHaveLength(1);
    const issued = (attempts.find(x => x.status === 'fulfilled') as PromiseFulfilledResult<Awaited<ReturnType<typeof service.issue>>>).value;
    expect(issued.status).toBe('ACTIVE');

    const beforeRenew = issued.expiresAt.getTime();
    const renewed = await service.renew('Bearer fake', issued.id);
    expect(renewed.expiresAt.getTime()).toBeGreaterThan(beforeRenew);

    const revoked = await service.revoke('Bearer fake', issued.id);
    expect(revoked.status).toBe('REVOKED');
    await expect(service.renew('Bearer fake', issued.id)).rejects.toThrow();
    await expect(service.issue('Bearer fake', deviceId)).resolves.toMatchObject({ status: 'ACTIVE' });
  });
});
