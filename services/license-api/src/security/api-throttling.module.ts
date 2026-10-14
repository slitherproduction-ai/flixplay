import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaService } from '../database/prisma.service';
import { PostgresThrottlerStorage } from './postgres-throttler.storage';

@Module({
  providers: [PrismaService, PostgresThrottlerStorage],
  exports: [PostgresThrottlerStorage],
})
class SharedThrottleStorageModule {}

@Module({
  imports: [ThrottlerModule.forRootAsync({
    imports: [SharedThrottleStorageModule],
    inject: [PostgresThrottlerStorage],
    useFactory: (storage: PostgresThrottlerStorage) => ({
      throttlers: [{ ttl: 60_000, limit: 10 }],
      storage,
    }),
  })],
  exports: [ThrottlerModule],
})
export class ApiThrottlingModule {}
