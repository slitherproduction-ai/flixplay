import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { sha256 } from '../devices/device-auth';
import { AuthService } from './auth.service';
import { encryptMfaSecret, decryptMfaSecret } from './admin-mfa-crypto';
import { verifyTotp } from './admin-totp';

@Injectable()
export class AdminMfaService {
  constructor(private readonly db: PrismaService, private readonly auth: AuthService) {}

  private async adminIdentity(authorization: string | undefined) {
    const id = await this.auth.authenticate(authorization);
    const user = await this.db.user.findUnique({ where: { id }, select: { role: true, email: true } });
    if (user?.role !== 'ADMIN') throw new ForbiddenException('Administrator required');
    return { id, email: user.email };
  }

  async enroll(authorization: string | undefined) {
    const actor = await this.adminIdentity(authorization);
    // Enrollment is only allowed once per administrator; reset requires an out-of-band recovery process.
    const existing = await this.db.adminMfaCredential.findUnique({ where: { userId: actor.id } });
    if (existing) throw new ConflictException('MFA credential already enrolled');
    const secret = randomBytes(20);
    const cipher = encryptMfaSecret(secret, actor.id);
    try {
      await this.db.adminMfaCredential.create({ data: { userId: actor.id, secretCipher: cipher } });
    } catch {
      throw new ConflictException('MFA enrollment already exists');
    }
    const base32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let acc = 0, bits = 0, encoded = '';
    for (const byte of secret) {
      acc = (acc << 8) | byte; bits += 8;
      while (bits >= 5) { bits -= 5; encoded += base32[(acc >>> bits) & 31]; }
    }
    if (bits > 0) encoded += base32[(acc << (5 - bits)) & 31];
    const uri = 'otpauth://totp/' + encodeURIComponent('ELVANOQ Cloud:' + actor.email) +
      '?secret=' + encoded + '&issuer=ELVANOQ%20Cloud&algorithm=SHA1&digits=6&period=30';
    return { setupUri: uri, message: 'Save this authenticator configuration securely; it is shown once.' };
  }

  private async rejected(userId: string, reason: string): Promise<never> {
    await this.db.$transaction(async tx => {
      const row = await tx.adminMfaCredential.update({
        where: { userId }, data: { failedAttempts: { increment: 1 } },
        select: { failedAttempts: true },
      });
      if (row.failedAttempts >= 5) {
        await tx.adminMfaCredential.update({
          where: { userId }, data: { lockedUntil: new Date(Date.now() + 15 * 60_000), failedAttempts: 0 },
        });
      }
      await tx.auditLog.create({
        data: { actorId: userId, action: 'admin.mfa.denied', subjectType: 'admin_mfa', subjectId: userId,
          metadata: { reason } },
      });
    });
    throw new UnauthorizedException('Invalid or unavailable MFA verification');
  }

  async verify(authorization: string | undefined, code: string) {
    const actor = await this.adminIdentity(authorization);
    const credential = await this.db.adminMfaCredential.findUnique({ where: { userId: actor.id } });
    if (!credential) throw new UnauthorizedException('MFA enrollment required');
    if (!/^[0-9]{6}$/.test(code)) return this.rejected(actor.id, 'INVALID_FORMAT');
    if (credential.lockedUntil && credential.lockedUntil > new Date()) {
      throw new UnauthorizedException('MFA temporarily locked');
    }
    const secret = decryptMfaSecret(credential.secretCipher, actor.id);
    const step = verifyTotp(secret, code);
    if (step === null) return this.rejected(actor.id, 'INVALID_CODE');
    const token = /^Bearer ([A-Za-z0-9_-]{40,80})$/.exec(authorization ?? '')?.[1];
    if (!token) throw new UnauthorizedException('Session missing');
    const result = await this.db.$transaction(async tx => {
      const consumed = await tx.adminMfaCredential.updateMany({
        where: { userId: actor.id, lastUsedStep: { lt: BigInt(step) } },
        data: { lastUsedStep: BigInt(step) },
      });
      if (consumed.count !== 1) return false;
      const updated = await tx.customerSession.updateMany({
        where: { userId: actor.id, tokenHash: sha256(token), revokedAt: null, expiresAt: { gt: new Date() } },
        data: { mfaVerifiedAt: new Date() },
      });
      return updated.count === 1;
    });
    if (!result) return this.rejected(actor.id, 'REUSED_CODE_OR_SESSION');
    await this.db.adminMfaCredential.update({
      where: { userId: actor.id }, data: { failedAttempts: 0, lockedUntil: null },
    });
    return { verified: true };
  }
}
