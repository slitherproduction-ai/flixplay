import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { AuthService } from './auth.service';
import { AdminMfaService } from './admin-mfa.service';
import { decryptMfaSecret } from './admin-mfa-crypto';
import { totpAt } from './admin-totp';
import { sha256 } from '../devices/device-auth';

const db = new PrismaService();
const auth = new AuthService(db);
const mfa = new AdminMfaService(db, auth);
let adminId = '';
let customerId = '';
let token = '';
let originalKey: string | undefined;

describe('admin session MFA and code replay', () => {
  beforeAll(async () => {
    originalKey = process.env.ADMIN_MFA_ENCRYPTION_KEY;
    process.env.ADMIN_MFA_ENCRYPTION_KEY = randomBytes(32).toString('hex');
    await db.$connect();
    const admin = await db.user.create({ data: { email: randomUUID() + '@example.test', passwordHash: 'test', role: 'ADMIN' } });
    const customer = await db.user.create({ data: { email: randomUUID() + '@example.test', passwordHash: 'test' } });
    adminId = admin.id;
    customerId = customer.id;
    token = randomBytes(32).toString('base64url');
    await db.customerSession.create({ data: { userId: adminId, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 600_000) } });
  });
  afterAll(async () => {
    if (adminId) await db.auditLog.deleteMany({ where: { actorId: adminId, action: 'admin.mfa.denied' } });
    if (adminId) await db.user.delete({ where: { id: adminId } });
    if (customerId) await db.user.delete({ where: { id: customerId } });
    await db.$disconnect();
    if (originalKey === undefined) delete process.env.ADMIN_MFA_ENCRYPTION_KEY;
    else process.env.ADMIN_MFA_ENCRYPTION_KEY = originalKey;
  });
  it('blocks password-only admin access, then accepts a single TOTP code', async () => {
    const header = 'Bearer ' + token;
    await expect(auth.authenticateAdmin(header)).rejects.toThrow();
    await mfa.enroll(header);
    const row = await db.adminMfaCredential.findUniqueOrThrow({ where: { userId: adminId } });
    const secret = decryptMfaSecret(row.secretCipher, adminId);
    const code = totpAt(secret, Math.floor(Date.now() / 30_000));
    await expect(mfa.verify(header, code)).resolves.toEqual({ verified: true });
    await expect(auth.authenticateAdmin(header)).resolves.toBe(adminId);
    await expect(mfa.verify(header, code)).rejects.toThrow();
    await expect(mfa.enroll(header)).rejects.toThrow();
  });
  it('records failed codes without secrets and locks out after repeated attempts', async () => {
    const header = 'Bearer ' + token;
    for (let i = 0; i < 5; i++) {
      await expect(mfa.verify(header, 'not-a-code')).rejects.toThrow();
    }
    const credential = await db.adminMfaCredential.findUniqueOrThrow({ where: { userId: adminId } });
    expect(credential.lockedUntil?.getTime()).toBeGreaterThan(Date.now());
    const logs = await db.auditLog.findMany({ where: { actorId: adminId, action: 'admin.mfa.denied' } });
    expect(logs.length).toBeGreaterThanOrEqual(5);
    expect(JSON.stringify(logs)).not.toContain(credential.secretCipher);
    await expect(mfa.verify(header, '123456')).rejects.toThrow('temporarily locked');
  });
  it('rejects customer enrollment', async () => {
    const customerToken = randomBytes(32).toString('base64url');
    await db.customerSession.create({ data: { userId: customerId, tokenHash: sha256(customerToken), expiresAt: new Date(Date.now() + 600_000) } });
    await expect(mfa.enroll('Bearer ' + customerToken)).rejects.toThrow();
  });
});
