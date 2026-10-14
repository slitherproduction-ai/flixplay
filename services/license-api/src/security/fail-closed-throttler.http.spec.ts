import 'reflect-metadata';
import { afterAll, beforeAll, Controller, Get, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { NestFactory } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { FailClosedThrottlerGuard } from './fail-closed-throttler.guard';

@Controller('check')
class TestController {
  @Get()
  check() { return { success: true }; }
}
@Module({
  imports: [ThrottlerModule.forRoot({
    throttlers: [{ ttl: 60000, limit: 3 }],
    storage: { increment: async () => { throw new Error('simulated database outage'); } },
  })],
  controllers: [TestController],
  providers: [{ provide: APP_GUARD, useClass: FailClosedThrottlerGuard }],
})
class TestModule {}

describe('HTTP behavior when rate limit storage fails', () => {
  let app: INestApplication;
  let url: string;
  beforeAll(async () => {
    app = await NestFactory.create(TestModule, { logger: false });
    await app.listen(0, '127.0.0.1');
    url = 'http://127.0.0.1:' + (app.getHttpServer().address() as { port: number }).port;
  });
  afterAll(async () => { if (app) await app.close(); });
  it('returns 503 instead of bypassing the failed rate limit', async () => {
    const response = await fetch(url + '/check');
    expect(response.status).toBe(503);
    const body = await response.json() as { message: string };
    expect(body.message).toBe('Rate limiting temporarily unavailable');
  });
});
