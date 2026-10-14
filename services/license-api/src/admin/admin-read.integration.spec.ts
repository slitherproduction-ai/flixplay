import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { AdminReadService } from './admin-read.service';
import { AuthService } from '../auth/auth.service';

const db = new PrismaService();
const auth = new AuthService(db);
const service = new AdminReadService(db, auth);
let adminId = '';
let customerId = '';
const adminToken = 'Bearer admin-test';
const customerToken = 'Bearer customer-test';

describe('admin read isolation', () => {
  beforeAll(async () => {
    await db.$connect();
    const admin = await db.user.create({ data: { email: randomUUID() + '@example.test', passwordHash: 'test', role: 'ADMIN' } });
    const customer = await db.user.create({ data: { email: randomUUID() + '@example.test', passwordHash: 'test', role: 'CUSTOMER' } });
    adminId = admin.id; customerId = customer.id;
  });
  afterAll(async () => {
    if (adminId) await db.user.delete({ where: { id: adminId } });
    if (customerId) await db.user.delete({ where: { id: customerId } });
    await db.$disconnect();
  });
  it('rejects customers and exposes no password hashes to administrators', async () => {
    const fakeAuth = { authenticate: async (header: string | undefined) => header === adminToken ? adminId : customerId } as AuthService;
    const instance = new AdminReadService(db, fakeAuth);
    await expect(instance.overview(customerToken)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(instance.customers(customerToken, 1)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(instance.licenses(customerToken, 1)).rejects.toBeInstanceOf(ForbiddenException);
    const result = await instance.customers(adminToken, 1);
    expect(result.items.some(item => item.id === customerId)).toBe(true);
    expect(JSON.stringify(result)).not.toContain('passwordHash');
    expect(JSON.stringify(result)).not.toContain('tokenHash');
  });
  it('restricts pagination to a bounded range', async () => {
    const fakeAuth = { authenticate: async () => adminId } as AuthService;
    const instance = new AdminReadService(db, fakeAuth);
    expect((await instance.customers(adminToken, -42)).page).toBe(1);
    expect((await instance.licenses(adminToken, 99999)).page).toBe(1000);
  });
});
