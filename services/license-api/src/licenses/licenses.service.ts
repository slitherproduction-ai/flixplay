import { Injectable } from '@nestjs/common';
import { LicenseStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class LicensesService {
  constructor(private readonly db: PrismaService) {}

  async listForCustomer(userId: string) {
    const now = new Date();
    const licenses = await this.db.license.findMany({
      where: { userId },
      include: {
        device: { select: { id: true, displayName: true, platform: true, publicCode: true } },
        plan: { select: { code: true, name: true, currency: true, priceCents: true, durationDays: true } },
      },
      orderBy: { expiresAt: 'desc' },
    });
    return licenses.map(({ id, status, startsAt, expiresAt, revokedAt, device, plan }) => ({
      id,
      status: revokedAt || status === LicenseStatus.REVOKED
        ? LicenseStatus.REVOKED
        : status === LicenseStatus.SUSPENDED
          ? LicenseStatus.SUSPENDED
          : expiresAt <= now
            ? LicenseStatus.EXPIRED
            : status,
      startsAt,
      expiresAt,
      device,
      plan,
    }));
  }

  async listPlans() {
    return this.db.plan.findMany({
      where: { isActive: true },
      select: { code: true, name: true, currency: true, priceCents: true, durationDays: true },
      orderBy: { priceCents: 'asc' },
    });
  }
}
