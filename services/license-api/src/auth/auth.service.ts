import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { PrismaService } from '../database/prisma.service';
import { sha256 } from '../devices/device-auth';

const scrypt = promisify(scryptCallback);
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return salt + ':' + derived.toString('hex');
}

async function checkPassword(password: string, encoded: string): Promise<boolean> {
  const [salt, hex] = encoded.split(':');
  if (!salt || !hex || !/^[a-f0-9]{128}$/.test(hex)) return false;
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return timingSafeEqual(derived, Buffer.from(hex, 'hex'));
}

@Injectable()
export class AuthService {
  constructor(private readonly db: PrismaService) {}

  async register(email: string, password: string) {
    const normalized = email.trim().toLowerCase();
    try {
      const user = await this.db.user.create({
        data: { email: normalized, passwordHash: await hashPassword(password) },
        select: { id: true, email: true },
      });
      return this.issueSession(user.id);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Account already exists');
      }
      throw error;
    }
  }

  async login(email: string, password: string) {
    const user = await this.db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user?.passwordHash || !(await checkPassword(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.issueSession(user.id);
  }

  private async issueSession(userId: string) {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
    await this.db.customerSession.create({ data: { userId, tokenHash: sha256(token), expiresAt } });
    return { accessToken: token, tokenType: 'Bearer', expiresAt: expiresAt.toISOString() };
  }

  async authenticate(header: string | undefined): Promise<string> {
    const match = /^Bearer ([A-Za-z0-9_-]{40,80})$/.exec(header ?? '');
    if (!match) throw new UnauthorizedException('Authentication required');
    const session = await this.db.customerSession.findUnique({
      where: { tokenHash: sha256(match[1]) },
      select: { userId: true, expiresAt: true, revokedAt: true },
    });
    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new UnauthorizedException('Session expired');
    }
    return session.userId;
  }

  async logout(header: string | undefined) {
    const userId = await this.authenticate(header);
    const match = /^Bearer ([A-Za-z0-9_-]{40,80})$/.exec(header!)!;
    await this.db.customerSession.updateMany({
      where: { userId, tokenHash: sha256(match[1]) },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }
}
