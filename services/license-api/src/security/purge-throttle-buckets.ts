import { PrismaService } from '../database/prisma.service';
import { PostgresThrottlerStorage } from './postgres-throttler.storage';

async function main() {
  if (process.env.THROTTLE_PURGE_CONFIRMED !== 'true') {
    throw new Error('Explicit THROTTLE_PURGE_CONFIRMED=true is required');
  }
  const db = new PrismaService();
  try {
    await db.$connect();
    const storage = new PostgresThrottlerStorage(db);
    const count = await storage.purgeExpired(500);
    console.log('Expired throttle buckets removed:', count);
  } finally {
    await db.$disconnect();
  }
}

main().catch(error => {
  console.error('Throttle cleanup failed:', error instanceof Error ? error.message : 'unknown error');
  process.exitCode = 1;
});
