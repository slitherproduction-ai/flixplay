import { performance } from 'node:perf_hooks';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { PostgresThrottlerStorage } from './postgres-throttler.storage';

async function benchmark() {
  if (process.env.NODE_ENV === 'production' || process.env.THROTTLE_BENCH_CONFIRMED !== 'true') {
    throw new Error('Only confirmed non-production runs are allowed');
  }
  const db = new PrismaService();
  const prefix = randomUUID();
  const count = 30;
  try {
    await db.$connect();
    const throttle = new PostgresThrottlerStorage(db);
    const latency: number[] = [];
    const started = performance.now();
    for (let i = 0; i < count; i++) {
      const begin = performance.now();
      await throttle.increment(prefix + ':' + i, 60_000, 10, 60_000, 'bench');
      latency.push(performance.now() - begin);
    }
    latency.sort((a, b) => a - b);
    console.log(JSON.stringify({ samples: count, elapsedMs: Math.round(performance.now() - started),
      p50Ms: Math.round(latency[14]), p95Ms: Math.round(latency[28]) }));
  } finally {
    await db.apiThrottleBucket.deleteMany({ where: { key: { startsWith: 'bench:' + prefix } } });
    await db.$disconnect();
  }
}
benchmark().catch(error => { console.error(error); process.exitCode = 1; });
