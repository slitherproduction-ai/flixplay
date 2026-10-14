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
  it('removes expired buckets but retains active blocks', async () => {
    const expiredKey = 'maintenance:' + randomUUID();
    const blockedKey = 'maintenance:' + randomUUID();
    const liveKey = 'maintenance:' + randomUUID();
    keys.push(expiredKey, blockedKey, liveKey);
    const past = new Date(Date.now() - 120_000);
    const future = new Date(Date.now() + 120_000);
    await firstDb.apiThrottleBucket.createMany({ data: [
      { key: expiredKey, hits: 3, windowEndsAt: past },
      { key: blockedKey, hits: 9, windowEndsAt: past, blockedUntil: future },
      { key: liveKey, hits: 1, windowEndsAt: future },
    ] });
    expect(await first.purgeExpired()).toBeGreaterThanOrEqual(1);
    expect(await firstDb.apiThrottleBucket.findUnique({ where: { key: expiredKey } })).toBeNull();
    expect(await firstDb.apiThrottleBucket.findUnique({ where: { key: blockedKey } })).not.toBeNull();
    expect(await firstDb.apiThrottleBucket.findUnique({ where: { key: liveKey } })).not.toBeNull();
  });
  it('does not purge an active block after its counting window has elapsed', async () => {
    const key = randomUUID();
    keys.push('default:' + key);
    await first.increment(key, 10, 1, 60_000, 'default');
    await second.increment(key, 10, 1, 60_000, 'default');
    await firstDb.apiThrottleBucket.update({
      where: { key: 'default:' + key }, data: { windowEndsAt: new Date(Date.now() - 5_000) },
    });
    await second.purgeExpired();
    const active = await firstDb.apiThrottleBucket.findUnique({ where: { key: 'default:' + key } });
    expect(active?.blockedUntil?.getTime()).toBeGreaterThan(Date.now());
  });
  it('reports aggregate counts without exposing bucket identifiers', async () => {
    const key = 'metrics:' + randomUUID();
    keys.push(key);
    await firstDb.apiThrottleBucket.create({
      data: { key, hits: 1, windowEndsAt: new Date(Date.now() + 60_000) },
    });
    const stats = await second.getStats();
    expect(stats.total).toBeGreaterThanOrEqual(1);
    expect(stats.expired).toBeGreaterThanOrEqual(0);
    expect(stats.activelyBlocked).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(stats)).not.toContain(key);
  });
  it('handles bounded concurrent increments on a shared bucket', async () => {
    const key = randomUUID();
    keys.push('default:' + key);
    const attempts = await Promise.all(Array.from({ length: 8 }, (_, index) =>
      (index % 2 ? second : first).increment(key, 60_000, 5, 60_000, 'default')));
    expect(attempts.map(x => x.totalHits).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 6, 6]);
    expect(attempts.filter(x => x.isBlocked).length).toBe(3);
  });
  it('isolates concurrency across distinct bucket identifiers', async () => {
    const left = randomUUID(), right = randomUUID();
    keys.push('default:' + left, 'default:' + right);
    const requests = await Promise.all(Array.from({ length: 10 }, (_, i) =>
      (i % 2 ? second : first).increment(i < 5 ? left : right, 60_000, 3, 60_000, 'default')));
    for (const group of [requests.slice(0, 5), requests.slice(5)]) {
      expect(group.map(x => x.totalHits).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 4]);
      expect(group.filter(x => x.isBlocked)).toHaveLength(2);
    }
  });
  it('rejects when storage is unavailable rather than granting access', async () => {
    const brokenClient = { $transaction: async () => { throw new Error('simulated outage'); } };
    const storage = new PostgresThrottlerStorage(brokenClient as unknown as PrismaService);
    await expect(storage.increment('test-key', 60000, 5, 60000, 'default')).rejects.toThrow('simulated outage');
  });
});
