import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { AuthService } from './auth.service';
import { AdminMfaRecoveryService } from './admin-mfa-recovery.service';
import { sha256 } from '../devices/device-auth';

const db = new PrismaService();
const auth = new AuthService(db);
const service = new AdminMfaRecoveryService(db, auth);
const users: string[] = [];
const headers: string[] = [];
const requestIds: string[] = [];
let requestId = '';
describe('independent administrator MFA recovery approval', () => {
  beforeAll(async () => {
    await db.$connect();
    for (let i = 0; i < 3; i++) {
      const user = await db.user.create({ data: { email: randomUUID() + '@example.test', passwordHash: 'test', role: 'ADMIN' } });
      users.push(user.id);
      const token = randomBytes(32).toString('base64url');
      await db.customerSession.create({ data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 600_000), mfaVerifiedAt: new Date() } });
      headers.push('Bearer ' + token);
    }
  });
  afterAll(async () => {
    if (requestIds.length) await db.auditLog.deleteMany({ where: { subjectId: { in: requestIds }, subjectType: 'admin_mfa_recovery' } });
    if (requestIds.length) await db.adminMfaRecoveryRequest.deleteMany({ where: { id: { in: requestIds } } });
    for (const id of users) await db.user.delete({ where: { id } });
    await db.$disconnect();
  });
  it('requires a distinct initiator and approver and does not reset MFA', async () => {
    await expect(service.request(headers[0], users[0], 'EVIDENCE-REFERENCE-2026')).rejects.toThrow();
    const result = await service.request(headers[0], users[2], 'EVIDENCE-REFERENCE-2026');
    requestId = result.id;
    requestIds.push(result.id);
    await expect(service.approve(headers[0], requestId)).rejects.toThrow();
    await expect(service.approve(headers[2], requestId)).rejects.toThrow();
    await expect(service.approve(headers[1], requestId)).resolves.toMatchObject({ status: 'APPROVED', resetEnabled: false });
    await expect(service.approve(headers[1], requestId)).rejects.toThrow();
    const logs = await db.auditLog.findMany({ where: { subjectId: requestId } });
    expect(logs.map(row => row.action)).toContain('admin.mfa.recovery_approved');
  });
  it('permits only one concurrent pending recovery for the same administrator', async () => {
    const requests = await Promise.allSettled([
      service.request(headers[0], users[1], 'CASE-EVIDENCE-2026-01'),
      service.request(headers[0], users[1], 'CASE-EVIDENCE-2026-02'),
    ]);
    const accepted = requests.filter((x): x is PromiseFulfilledResult<Awaited<ReturnType<typeof service.request>>> => x.status === 'fulfilled');
    expect(accepted).toHaveLength(1);
    expect(requests.filter(x => x.status === 'rejected')).toHaveLength(1);
    requestIds.push(accepted[0].value.id);
  });
  it('issues and consumes an expiring grant only once in test mode without modifying MFA', async () => {
    const before = process.env.ADMIN_MFA_RECOVERY_GRANTS_ENABLED;
    process.env.ADMIN_MFA_RECOVERY_GRANTS_ENABLED = 'true';
    try {
      const result = await service.request(headers[0], users[0], 'GRANT-TEST-2026').catch(() => null);
      expect(result).toBeNull();
      const another = await service.request(headers[0], users[2], 'GRANT-TEST-2026');
      requestIds.push(another.id);
      const approved = await service.approve(headers[1], another.id);
      expect(approved.resetEnabled).toBe(false);
      expect(approved.oneTimeGrant).toMatch(/^[A-Za-z0-9_-]{43}$/);
      const token = approved.oneTimeGrant!;
      await expect(service.consumeTestGrant(headers[1], another.id, token)).resolves.toEqual({ consumed: true, resetEnabled: false });
      await expect(service.consumeTestGrant(headers[1], another.id, token)).rejects.toThrow();
      const row = await db.adminMfaRecoveryRequest.findUniqueOrThrow({ where: { id: another.id } });
      expect(row.grantHash).not.toEqual(token);
    } finally {
      if (before === undefined) delete process.env.ADMIN_MFA_RECOVERY_GRANTS_ENABLED;
      else process.env.ADMIN_MFA_RECOVERY_GRANTS_ENABLED = before;
    }
  });
  it('does not approve a recovery whose expiry has elapsed', async () => {
    const result = await service.request(headers[0], users[0], 'CASE-EVIDENCE-EXPIRED').catch(() => null);
    expect(result).toBeNull();
    const latest = await db.adminMfaRecoveryRequest.findFirst({ where: { targetUserId: users[1], status: 'PENDING' } });
    expect(latest).not.toBeNull();
    await db.adminMfaRecoveryRequest.update({ where: { id: latest!.id }, data: { expiresAt: new Date(Date.now() - 1_000) } });
    await expect(service.approve(headers[2], latest!.id)).rejects.toThrow('not pending');
  });
});
