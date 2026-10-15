import { createHmac, timingSafeEqual } from 'node:crypto';

/** RFC 6238 SHA-1 TOTP, 30-second steps, six digits. Secrets are raw bytes. */
export function totpAt(secret: Uint8Array, step: number): string {
  if (secret.length < 20 || !Number.isSafeInteger(step) || step < 0) throw new Error('Invalid TOTP input');
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const mac = createHmac('sha1', Buffer.from(secret)).update(counter).digest();
  const index = mac[mac.length - 1] & 15;
  const value = (mac.readUInt32BE(index) & 0x7fffffff) % 1_000_000;
  return String(value).padStart(6, '0');
}

export function verifyTotp(secret: Uint8Array, code: string, nowMs = Date.now()): number | null {
  if (!/^[0-9]{6}$/.test(code) || !Number.isFinite(nowMs) || nowMs < 0) return null;
  const current = Math.floor(nowMs / 30_000);
  for (const offset of [-1, 0, 1]) {
    const step = current + offset;
    if (step < 0) continue;
    const expected = totpAt(secret, step);
    if (timingSafeEqual(Buffer.from(code), Buffer.from(expected))) return step;
  }
  return null;
}
