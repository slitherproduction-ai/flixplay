import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function createDeviceSecret(): string {
  return randomBytes(32).toString('base64url');
}

export function verifyDeviceSecret(header: string | undefined, expectedHash: string): void {
  const match = /^Bearer ([A-Za-z0-9_-]{40,80})$/.exec(header ?? '');
  if (!match) throw new UnauthorizedException('Invalid device authorization');
  const received = Buffer.from(sha256(match[1]), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new UnauthorizedException('Invalid device authorization');
  }
}

export function publicDeviceCode(): string {
  return randomBytes(8).toString('hex').toUpperCase();
}

export function pairingCode(): string {
  // 8 digits = 100 million options. Still time-limited and subject to rate limits.
  return String(randomBytes(4).readUInt32BE(0) % 100_000_000).padStart(8, '0');
}
