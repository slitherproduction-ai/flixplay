import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class AdminReadService {
  constructor(private readonly db: PrismaService, private readonly auth: AuthService) {}

  async requireAdmin(authorization: string | undefined): Promise<string> {
    const actorId = await this.auth.authenticate(authorization);
    const actor = await this.db.user.findUnique({ where: { id: actorId }, select: { role: true } });
    if (!actor) throw new UnauthorizedException('Session owner missing');
    if (actor.role !== 'ADMIN') throw new ForbiddenException('Administrator access required');
    return actorId;
  }

  async overview(authorization: string | undefined) {
    await this.requireAdmin(authorization);
    const [customers, devices, licenses, activeLicenses] = await Promise.all([
      this.db.user.count({ where: { role: 'CUSTOMER' } }),
      this.db.device.count(),
      this.db.license.count(),
      this.db.license.count({ where: { status: 'ACTIVE', revokedAt: null, expiresAt: { gt: new Date() } } }),
    ]);
    return { customers, devices, licenses, activeLicenses };
  }

  async customers(authorization: string | undefined, page: number) {
    await this.requireAdmin(authorization);
    const safePage = Math.min(1000, Math.max(1, page));
    const [total, items] = await Promise.all([
      this.db.user.count({ where: { role: 'CUSTOMER' } }),
      this.db.user.findMany({
        where: { role: 'CUSTOMER' },
        select: { id: true, email: true, createdAt: true, _count: { select: { devices: true, licenses: true } } },
        orderBy: { createdAt: 'desc' }, take: 25, skip: (safePage - 1) * 25,
      }),
    ]);
    return { items, total, page: safePage, pageSize: 25 };
  }

  async licenses(authorization: string | undefined, page: number) {
    await this.requireAdmin(authorization);
    const safePage = Math.min(1000, Math.max(1, page));
    const [total, items] = await Promise.all([
      this.db.license.count(),
      this.db.license.findMany({
        select: {
          id: true, status: true, startsAt: true, expiresAt: true, revokedAt: true,
          user: { select: { id: true, email: true } },
          device: { select: { id: true, publicCode: true, platform: true, displayName: true } },
          plan: { select: { name: true, code: true, priceCents: true, currency: true } },
        },
        orderBy: { createdAt: 'desc' }, take: 25, skip: (safePage - 1) * 25,
      }),
    ]);
    return { items, total, page: safePage, pageSize: 25 };
  }
}
