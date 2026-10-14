import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { LicenseStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuthService } from '../auth/auth.service';

const YEARLY_PLAN_CODE = 'ELVANOQ_ANNUAL_2490';
const MAX_RETRIES = 3;

@Injectable()
export class AdminLicensesService {
  constructor(private readonly db: PrismaService, private readonly auth: AuthService) {}

  private async authorizedAdmin(header: string | undefined) {
    if (process.env.LICENSE_ADMIN_WRITES_ENABLED !== 'true' || process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Administrative license mutations are disabled');
    }
    const actorId = await this.auth.authenticate(header);
    const actor = await this.db.user.findUnique({ where: { id: actorId }, select: { role: true } });
    if (actor?.role !== 'ADMIN') throw new ForbiddenException('Administrator required');
    return actorId;
  }

  private async transactionWithRetry<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await this.db.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034' && attempt < MAX_RETRIES - 1) continue;
        throw error;
      }
    }
    throw new ConflictException('Transaction conflict');
  }

  async issue(header: string | undefined, deviceId: string) {
    const actorId = await this.authorizedAdmin(header);
    return this.transactionWithRetry(async tx => {
      const device = await tx.device.findUnique({ where: { id: deviceId }, select: { userId: true } });
      if (!device?.userId) throw new NotFoundException('Linked device not found');
      const plan = await tx.plan.findUnique({ where: { code: YEARLY_PLAN_CODE } });
      if (!plan || !plan.isActive || plan.priceCents !== 2490 || plan.currency !== 'BRL' || plan.durationDays !== 365) {
        throw new ConflictException('Annual plan not provisioned correctly');
      }
      // A per-device advisory lock serializes all administrative license mutations in PostgreSQL.
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${deviceId}))`;
      const now = new Date();
      const overlapping = await tx.license.findFirst({
        where: { deviceId, revokedAt: null, status: { in: ['TRIAL', 'ACTIVE', 'GRACE_PERIOD', 'SUSPENDED'] }, expiresAt: { gt: now } },
      });
      if (overlapping) throw new ConflictException('Device already has an unexpired license');
      const expiresAt = new Date(now.getTime() + plan.durationDays * 86_400_000);
      const license = await tx.license.create({
        data: { userId: device.userId, deviceId, planId: plan.id, status: LicenseStatus.ACTIVE, startsAt: now, expiresAt },
        select: { id: true, status: true, startsAt: true, expiresAt: true, deviceId: true },
      });
      await tx.auditLog.create({ data: { actorId, action: 'license.test_issued', subjectType: 'license', subjectId: license.id, metadata: { deviceId, planCode: plan.code } } });
      return license;
    });
  }

  async renew(header: string | undefined, licenseId: string) {
    const actorId = await this.authorizedAdmin(header);
    return this.transactionWithRetry(async tx => {
      const existing = await tx.license.findUnique({ where: { id: licenseId }, include: { plan: true } });
      if (!existing) throw new NotFoundException('License not found');
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${existing.deviceId}))`;
      if (existing.revokedAt || existing.status === LicenseStatus.REVOKED || existing.status === LicenseStatus.SUSPENDED) {
        throw new ConflictException('Revoked or suspended licenses cannot be renewed');
      }
      if (existing.plan.code !== YEARLY_PLAN_CODE || existing.plan.durationDays !== 365) {
        throw new ConflictException('Unsupported plan');
      }
      const others = await tx.license.findFirst({
        where: { id: { not: existing.id }, deviceId: existing.deviceId, revokedAt: null, expiresAt: { gt: new Date() }, status: { in: ['TRIAL', 'ACTIVE', 'GRACE_PERIOD', 'SUSPENDED'] } },
      });
      if (others) throw new ConflictException('Another active entitlement exists for this device');
      const now = new Date();
      const base = existing.expiresAt > now ? existing.expiresAt : now;
      const expiresAt = new Date(base.getTime() + 365 * 86_400_000);
      const license = await tx.license.update({ where: { id: licenseId }, data: { status: LicenseStatus.ACTIVE, expiresAt }, select: { id: true, status: true, expiresAt: true } });
      await tx.auditLog.create({ data: { actorId, action: 'license.test_renewed', subjectType: 'license', subjectId: license.id } });
      return license;
    });
  }

  async revoke(header: string | undefined, licenseId: string) {
    const actorId = await this.authorizedAdmin(header);
    return this.transactionWithRetry(async tx => {
      const existing = await tx.license.findUnique({ where: { id: licenseId } });
      if (!existing) throw new NotFoundException('License not found');
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${existing.deviceId}))`;
      if (existing.revokedAt || existing.status === LicenseStatus.REVOKED) return { id: existing.id, status: LicenseStatus.REVOKED };
      const license = await tx.license.update({ where: { id: licenseId }, data: { status: LicenseStatus.REVOKED, revokedAt: new Date() }, select: { id: true, status: true } });
      await tx.auditLog.create({ data: { actorId, action: 'license.test_revoked', subjectType: 'license', subjectId: license.id } });
      return license;
    });
  }
}
