import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { DevicesService } from './devices.service';

const db = new PrismaService();
const service = new DevicesService(db);
let firstUser = '';
let secondUser = '';
let firstDevice = '';
let secondDevice = '';

describe('customer device isolation and public response', () => {
  beforeAll(async () => {
    await db.$connect();
    const a = await db.user.create({ data: { email: randomUUID() + '@example.test', passwordHash: 'test' } });
    const b = await db.user.create({ data: { email: randomUUID() + '@example.test', passwordHash: 'test' } });
    firstUser = a.id;
    secondUser = b.id;
    const first = await db.device.create({ data: {
      userId: firstUser, platform: 'ANDROID_TV', publicCode: randomUUID(), deviceKeyHash: randomBytes(32).toString('hex'),
      displayName: 'Sala',
    } });
    const second = await db.device.create({ data: {
      userId: secondUser, platform: 'FIRE_TV', publicCode: randomUUID(), deviceKeyHash: randomBytes(32).toString('hex'),
      displayName: 'Outro cliente',
    } });
    firstDevice = first.id; secondDevice = second.id;
  });

  afterAll(async () => {
    if (firstDevice) await db.device.delete({ where: { id: firstDevice } });
    if (secondDevice) await db.device.delete({ where: { id: secondDevice } });
    if (firstUser) await db.user.delete({ where: { id: firstUser } });
    if (secondUser) await db.user.delete({ where: { id: secondUser } });
    await db.$disconnect();
  });

  it('returns only owned devices without bearer hashes or proof keys', async () => {
    const result = await service.listForCustomer(firstUser);
    expect(result.devices).toHaveLength(1);
    expect(result.devices[0].id).toBe(firstDevice);
    expect(JSON.stringify(result)).not.toContain(secondDevice);
    expect(result.devices[0]).not.toHaveProperty('deviceKeyHash');
    expect(result.devices[0]).not.toHaveProperty('proofPublicKey');
    expect(result.devices[0]).not.toHaveProperty('pairingSessions');
  });
  it('isolates another customer account', async () => {
    const result = await service.listForCustomer(secondUser);
    expect(result.devices).toHaveLength(1);
    expect(result.devices[0].id).toBe(secondDevice);
    expect(JSON.stringify(result)).not.toContain(firstDevice);
  });
});
