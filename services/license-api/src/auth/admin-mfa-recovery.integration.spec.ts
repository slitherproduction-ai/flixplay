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
    if (requestId) await db.auditLog.deleteMany({ where: { subjectId: requestId, subjectType: 'admin_mfa_recovery' } });
    if (requestId) await db.adminMfaRecoveryRequest.delete({ where: { id: requestId } });
    for (const id of users) await db.user.delete({ where: { id } });
    await db.$disconnect();
  });
  it('requires a distinct initiator and approver and does not reset MFA', async () => {
    await expect(service.request(headers[0], users[0], 'EVIDENCE-REFERENCE-2026')).rejects.toThrow();
    const result = await service.request(headers[0], users[2], 'EVIDENCE-REFERENCE-2026');
    requestId = result.id;
    await expect(service.approve(headers[0], requestId)).rejects.toThrow();
    await expect(service.approve(headers[2], requestId)).rejects.toThrow();
    await expect(service.approve(headers[1], requestId)).resolves.toMatchObject({ status: 'APPROVED', resetEnabled: false });
    await expect(service.approve(headers[1], requestId)).rejects.toThrow();
    const logs = await db.auditLog.findMany({ where: { subjectId: requestId } });
    expect(logs.map(row => row.action)).toContain('admin.mfa.recovery_approved');
  });
});
