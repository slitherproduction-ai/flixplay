import { describe, expect, it, vi } from 'vitest';
import { AdminLicensesService } from './admin-licenses.service';

describe('AdminLicensesService safety gates', () => {
  it('rejects issuance unless staging mutation gate is explicitly enabled', async () => {
    const old = process.env.LICENSE_ADMIN_WRITES_ENABLED;
    delete process.env.LICENSE_ADMIN_WRITES_ENABLED;
    const service = new AdminLicensesService({} as any, { authenticate: vi.fn() } as any);
    await expect(service.issue(undefined, 'unused')).rejects.toThrow('disabled');
    if (old === undefined) delete process.env.LICENSE_ADMIN_WRITES_ENABLED;
    else process.env.LICENSE_ADMIN_WRITES_ENABLED = old;
  });

  it('rejects non-admin users even in staging', async () => {
    const oldEnv = process.env.NODE_ENV;
    const oldFlag = process.env.LICENSE_ADMIN_WRITES_ENABLED;
    process.env.NODE_ENV = 'test';
    process.env.LICENSE_ADMIN_WRITES_ENABLED = 'true';
    try {
      const db = { user: { findUnique: vi.fn().mockResolvedValue({ role: 'CUSTOMER' }) } };
      const service = new AdminLicensesService(db as any, { authenticate: vi.fn().mockResolvedValue('user-id') } as any);
      await expect(service.issue('Bearer token', 'device-id')).rejects.toThrow('Administrator required');
    } finally {
      if (oldEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oldEnv;
      if (oldFlag === undefined) delete process.env.LICENSE_ADMIN_WRITES_ENABLED; else process.env.LICENSE_ADMIN_WRITES_ENABLED = oldFlag;
    }
  });
});
