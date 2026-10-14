import { Injectable, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { verifyDeviceSecret } from '../devices/device-auth';
import { issueEntitlement } from './entitlement-crypto';

@Injectable()
export class DeviceEntitlementService {
  constructor(private readonly db: PrismaService) {}

  async getEntitlement(deviceId: string, authorization: string | undefined) {
    const device = await this.db.device.findUnique({ where: { id: deviceId }, select: { id: true, userId: true, deviceKeyHash: true } });
    if (!device) throw new NotFoundException('Device not found');
    verifyDeviceSecret(authorization, device.deviceKeyHash);
    if (!device.userId) throw new UnauthorizedException('Device not linked');
    const now = new Date();
    const license = await this.db.license.findFirst({
      where: {
        deviceId, userId: device.userId, revokedAt: null,
        startsAt: { lte: now }, expiresAt: { gt: now },
        status: { in: ['ACTIVE', 'TRIAL', 'GRACE_PERIOD'] },
      },
      orderBy: { expiresAt: 'desc' },
      select: { id: true, status: true, expiresAt: true },
    });
    if (!license) return { authorized: false, status: 'INACTIVE' as const };
    // No signing key means fail closed, never issue unsigned entitlement.
    const pem = process.env.ENTITLEMENT_PRIVATE_KEY_PEM?.replace(/\\n/g, '\n');
    if (!pem) throw new ServiceUnavailableException('Entitlement signing is not configured');
    const issuedAt = Math.floor(Date.now() / 1000);
    const exp = Math.min(issuedAt + 5 * 60, Math.floor(license.expiresAt.getTime() / 1000));
    if (exp <= issuedAt) return { authorized: false, status: 'EXPIRED' as const };
    const kid = process.env.ENTITLEMENT_KEY_ID || 'v1';
    const token = issueEntitlement({
      iss: 'elvanoq-cloud', aud: 'elvanoq-play', sub: deviceId, deviceId,
      licenseId: license.id, iat: issuedAt, exp,
    }, pem, kid);
    return { authorized: true, status: license.status, expiresAt: license.expiresAt, entitlement: token, tokenExpiresAt: new Date(exp * 1000).toISOString() };
  }
}
