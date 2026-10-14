import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/** Master key must be 32 random bytes, supplied as 64 hex digits via secret manager. */
function masterKey(): Buffer {
  const value = process.env.ADMIN_MFA_ENCRYPTION_KEY;
  if (!value || !/^[a-fA-F0-9]{64}$/.test(value)) throw new Error('ADMIN_MFA_ENCRYPTION_KEY not configured');
  return Buffer.from(value, 'hex');
}
export function encryptMfaSecret(secret: Buffer, userId: string): string {
  if (secret.length < 20 || !/^[a-fA-F0-9-]{36}$/.test(userId)) throw new Error('Invalid MFA encryption input');
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', masterKey(), nonce);
  cipher.setAAD(Buffer.from(userId));
  const payload = Buffer.concat([cipher.update(secret), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), payload]).toString('base64url');
}
export function decryptMfaSecret(encoded: string, userId: string): Buffer {
  const raw = Buffer.from(encoded, 'base64url');
  if (raw.length < 12 + 16 + 20) throw new Error('Invalid MFA ciphertext');
  const cipher = createDecipheriv('aes-256-gcm', masterKey(), raw.subarray(0, 12));
  cipher.setAAD(Buffer.from(userId));
  cipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([cipher.update(raw.subarray(28)), cipher.final()]);
}
