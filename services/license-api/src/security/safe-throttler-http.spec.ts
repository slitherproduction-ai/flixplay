import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Controller, Get, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { NestFactory } from '@nestjs/core';
import { ThrottlerModule, ThrottlerException, ThrottlerStorage } from '@nestjs/throttler';
import type { INestApplication } from '@nestjs/common';
import { SafeThrottlerGuard } from './safe-throttler.guard';

@Controller('probe')
class ProbeController { @Get() get() { return { ok: true }; } }

const storage = { increment: async () => { throw new Error('PostgreSQL unavailable'); } };

@Module({
 imports: [ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 5 }], storage: storage as unknown as ThrottlerStorage })],
 controllers: [ProbeController],
 providers: [{ provide: APP_GUARD, useClass: SafeThrottlerGuard }],
})
class OutageTestModule {}

describe('throttle HTTP outage response', () => {
 let app: INestApplication;
 let url: string;
 beforeAll(async () => {
   app = await NestFactory.create(OutageTestModule, { logger: false });
   await app.listen(0, '127.0.0.1');
   const address = app.getHttpServer().address() as { port: number };
   url = 'http://127.0.0.1:' + address.port;
 });
 afterAll(async () => { if (app) await app.close(); });
 it('returns 503 instead of allowing requests when shared storage fails', async () => {
   const response = await fetch(url + '/probe');
   expect(response.status).toBe(503);
   const body = await response.json() as { message: string };
   expect(body.message).toBe('Request protection temporarily unavailable');
 });
});
