import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { encryptMfaSecret, decryptMfaSecret } from './admin-mfa-crypto';
describe('admin MFA encryption', () => {
  it('decrypts for same administrator and rejects different account/tampering', () => {
    const original = process.env.ADMIN_MFA_ENCRYPTION_KEY;
    process.env.ADMIN_MFA_ENCRYPTION_KEY = '4a'.repeat(32);
    try {
      const first = randomUUID(), second = randomUUID();
      const secret = Buffer.alloc(20, 42);
      const ciphertext = encryptMfaSecret(secret, first);
      expect(decryptMfaSecret(ciphertext, first)).toEqual(secret);
      expect(() => decryptMfaSecret(ciphertext, second)).toThrow();
      const bytes = Buffer.from(ciphertext, 'base64url');
      bytes[bytes.length - 1] ^= 1;
      expect(() => decryptMfaSecret(bytes.toString('base64url'), first)).toThrow();
    } finally {
      if (original === undefined) delete process.env.ADMIN_MFA_ENCRYPTION_KEY;
      else process.env.ADMIN_MFA_ENCRYPTION_KEY = original;
    }
  });
});
