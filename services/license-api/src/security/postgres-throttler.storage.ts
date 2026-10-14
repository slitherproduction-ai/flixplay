import { Injectable } from '@nestjs/common';
import { ThrottlerStorage, ThrottlerStorageRecord } from '@nestjs/throttler';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class PostgresThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly db: PrismaService) {}

  async increment(key: string, ttl: number, limit: number, blockDuration: number, throttlerName: string): Promise<ThrottlerStorageRecord> {
    const bucketKey = throttlerName + ':' + key;
    const duration = Math.max(1, ttl);
    return this.db.$transaction(async tx => {
      const now = new Date();
      await tx.apiThrottleBucket.createMany({
        data: [{ key: bucketKey, hits: 0, windowEndsAt: new Date(now.getTime() + duration) }],
        skipDuplicates: true,
      });
      // Serialize increments across independent API replicas sharing PostgreSQL.
      await tx.$queryRaw`SELECT "key" FROM "ApiThrottleBucket" WHERE "key" = ${bucketKey} FOR UPDATE`;
      const current = await tx.apiThrottleBucket.findUniqueOrThrow({ where: { key: bucketKey } });
      const blocked = !!current.blockedUntil && current.blockedUntil > now;
      const expired = current.windowEndsAt <= now;
      const hits = blocked ? current.hits : (expired ? 1 : current.hits + 1);
      const windowEndsAt = expired && !blocked ? new Date(now.getTime() + duration) : current.windowEndsAt;
      const blockedUntil = blocked ? current.blockedUntil : hits > limit
        ? new Date(now.getTime() + Math.max(1, blockDuration)) : null;
      await tx.apiThrottleBucket.update({ where: { key: bucketKey }, data: { hits, windowEndsAt, blockedUntil } });
      const remaining = (date: Date | null) => date ? Math.max(0, Math.ceil((date.getTime() - now.getTime()) / 1000)) : 0;
      return {
        totalHits: hits,
        timeToExpire: remaining(windowEndsAt),
        isBlocked: !!blockedUntil && blockedUntil > now,
        timeToBlockExpire: remaining(blockedUntil),
      };
    });
  }
}
