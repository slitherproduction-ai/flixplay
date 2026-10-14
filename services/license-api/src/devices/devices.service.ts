import { Injectable, NotFoundException } from '@nestjs/common';
import { DevicePlatform, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { createDeviceSecret, pairingCode, publicDeviceCode, sha256, verifyDeviceSecret } from './device-auth';

@Injectable()
export class DevicesService {
  constructor(private readonly db: PrismaService) {}

  async register(platform: DevicePlatform, displayName?: string) {
    // Server-issued device credential is returned once. The app must store it in SecureStore.
    for (let attempt = 0; attempt < 3; attempt++) {
      const secret = createDeviceSecret();
      try {
        const device = await this.db.device.create({
          data: { platform, displayName, publicCode: publicDeviceCode(), deviceKeyHash: sha256(secret) },
          select: { id: true, publicCode: true, platform: true },
        });
        return { ...device, deviceSecret: secret };
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      }
    }
    throw new Error('Device registration could not allocate a unique code');
  }

  async startPairing(deviceId: string, authorization: string | undefined) {
    // No customer linking is exposed until account auth and claim validation are implemented.
    const device = await this.db.device.findUnique({ where: { id: deviceId } });
    if (!device) throw new NotFoundException('Device not found');
    verifyDeviceSecret(authorization, device.deviceKeyHash);
    const code = pairingCode();
    const expiresAt = new Date(Date.now() + 5 * 60_000);
    await this.db.$transaction(async (tx) => {
      await tx.pairingSession.deleteMany({ where: { deviceId } });
      await tx.pairingSession.create({ data: { deviceId, codeHash: sha256(code), expiresAt } });
    });
    return { pairingCode: code, expiresAt: expiresAt.toISOString() };
  }
}
