import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Module, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AdminMfaController } from './admin-mfa.controller';
import { AdminMfaService } from './admin-mfa.service';
import { AdminMfaRecoveryController } from './admin-mfa-recovery.controller';
import { AdminMfaRecoveryService } from './admin-mfa-recovery.service';

@Module({
  controllers: [AuthController, AdminMfaController, AdminMfaRecoveryController],
  providers: [
    { provide: AuthService, useValue: { login: async () => ({ accessToken: 'sample' }), register: async () => ({ accessToken: 'sample' }), logout: async () => ({ success: true }) } },
    { provide: AdminMfaService, useValue: { verify: async () => ({ verified: true }), enroll: async () => ({ setupUri: 'test' }) } },
    { provide: AdminMfaRecoveryService, useValue: { approve: async () => ({ resetEnabled: false }), request: async () => ({ status: 'PENDING' }), consumeTestGrant: async () => ({ consumed: false }) } },
  ],
})
class SecurityRoutesTestModule {}

describe('HTTP security boundary', () => {
  let app: INestApplication;
  let url: string;
  beforeAll(async () => {
    app = await NestFactory.create(SecurityRoutesTestModule, { logger: false });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as { port: number };
    url = 'http://127.0.0.1:' + address.port;
  });
  afterAll(async () => { if (app) await app.close(); });
  it('marks login responses non-cacheable', async () => {
    const response = await fetch(url + '/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.test', password: 'adequate-test-password' }) });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
  it('rejects invalid TOTP bodies without invoking service', async () => {
    const response = await fetch(url + '/v1/auth/admin-mfa/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 'not-valid' }) });
    expect(response.status).toBe(400);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
  it('rejects malformed recovery identifiers', async () => {
    const response = await fetch(url + '/v1/internal/admin-mfa-recovery/invalid/approve', { method: 'POST' });
    expect(response.status).toBe(400);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});
