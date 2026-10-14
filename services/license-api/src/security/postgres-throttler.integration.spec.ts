import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../database/prisma.service';
import { PostgresThrottlerStorage } from './postgres-throttler.storage';
import { randomUUID } from 'node:crypto';

const firstDb = new PrismaService();
const secondDb = new PrismaService();
const first = new PostgresThrottlerStorage(firstDb);
const second = new PostgresThrottlerStorage(secondDb);
const keys: string[] = [];

describe('PostgreSQL distributed rate limiting', () => {
  beforeAll(async () => {
    await Promise.all([firstDb.$connect(), secondDb.$connect()]);
  });
  afterAll(async () => {
    await firstDb.apiThrottleBucket.deleteMany({ where: { key: { in: keys } } });
    await Promise.all([firstDb.$disconnect(), secondDb.$disconnect()]);
  });
  it('enforces one shared threshold across two independent clients', async () => {
    const key = randomUUID();
    keys.push('default:' + key);
    const attempts = await Promise.all([
      first.increment(key, 60_000, 2, 60_000, 'default'),
      second.increment(key, 60_000, 2, 60_000, 'default'),
    ]);
    expect(attempts.map(x => x.totalHits).sort()).toEqual([1, 2]);
    const blocked = await first.increment(key, 60_000, 2, 60_000, 'default');
    expect(blocked.isBlocked).toBe(true);
    expect(blocked.totalHits).toBe(3);
    const stillBlocked = await second.increment(key, 60_000, 2, 60_000, 'default');
    expect(stillBlocked.isBlocked).toBe(true);
    expect(stillBlocked.totalHits).toBe(3);
  });
  it('separates named throttle windows', async () => {
    const key = randomUUID();
    keys.push('login:' + key, 'recovery:' + key);
    await first.increment(key, 60_000, 1, 60_000, 'login');
    const blocked = await second.increment(key, 60_000, 1, 60_000, 'login');
    const separate = await second.increment(key, 60_000, 1, 60_000, 'recovery');
    expect(blocked.isBlocked).toBe(true);
    expect(separate.isBlocked).toBe(false);
  });
});
