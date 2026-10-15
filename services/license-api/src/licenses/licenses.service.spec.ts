import { describe, expect, it, vi } from 'vitest';
import { LicensesService } from './licenses.service';

describe('LicensesService', () => {
  it('expires an overdue active license without altering the database record', async () => {
    const findMany = vi.fn().mockResolvedValue([{
      id: 'sample', status: 'ACTIVE', startsAt: new Date('2025-01-01'),
      expiresAt: new Date('2025-01-02'), revokedAt: null,
      device: { id: 'device' }, plan: { code: 'ANNUAL' },
    }]);
    const service = new LicensesService({ license: { findMany } } as any);
    const response = await service.listForCustomer('user');
    expect(response[0].status).toBe('EXPIRED');
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user' } }));
  });
  it('never reactivates a revoked license', async () => {
    const findMany = vi.fn().mockResolvedValue([{
      id: 'sample', status: 'REVOKED', startsAt: new Date('2025-01-01'),
      expiresAt: new Date('2099-01-02'), revokedAt: new Date(),
      device: {}, plan: {},
    }]);
    const service = new LicensesService({ license: { findMany } } as any);
    expect((await service.listForCustomer('user'))[0].status).toBe('REVOKED');
  });
});
