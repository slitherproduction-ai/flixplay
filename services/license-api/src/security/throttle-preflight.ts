import { PrismaService } from '../database/prisma.service';
import { PostgresThrottlerStorage } from './postgres-throttler.storage';

async function main() {
  if (process.env.NODE_ENV === 'production' || process.env.THROTTLE_PREFLIGHT_CONFIRMED !== 'true') {
    throw new Error('Preflight requires explicit confirmation in a non-production environment');
  }
  const db = new PrismaService();
  try {
    await db.$connect();
    const storage = new PostgresThrottlerStorage(db);
    const stats = await storage.getStats();
    const migrations = await db.$queryRaw<Array<{ missing: boolean }>>`
      SELECT NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = current_schema() AND table_name = 'ApiThrottleBucket'
      ) AS missing
    `;
    if (migrations[0]?.missing) throw new Error('Throttle bucket migration not applied');
    console.log(JSON.stringify({ check: 'throttle_preflight', status: 'ok', ...stats }));
  } finally {
    await db.$disconnect();
  }
}
main().catch(error => {
  console.error('Throttle preflight failed:', error instanceof Error ? error.message : 'unknown error');
  process.exitCode = 1;
});
