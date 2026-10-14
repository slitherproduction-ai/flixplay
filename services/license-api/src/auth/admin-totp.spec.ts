import { describe, expect, it } from 'vitest';
import { totpAt, verifyTotp } from './admin-totp';

const secret = Buffer.from('3132333435363738393031323334353637383930', 'hex');

describe('TOTP primitive RFC6238', () => {
  it('matches SHA1 vectors', () => {
    expect(totpAt(secret, 1)).toBe('287082');
    expect(totpAt(secret, Math.floor(1111111109 / 30))).toBe('081804');
    expect(totpAt(secret, Math.floor(1111111111 / 30))).toBe('050471');
    expect(totpAt(secret, Math.floor(1234567890 / 30))).toBe('005924');
  });
  it('accepts adjacent steps and rejects out of window', () => {
    expect(verifyTotp(secret, totpAt(secret, 4), 120000)).toBe(4);
    expect(verifyTotp(secret, totpAt(secret, 3), 120000)).toBe(3);
    expect(verifyTotp(secret, totpAt(secret, 5), 120000)).toBe(5);
    expect(verifyTotp(secret, totpAt(secret, 9), 120000)).toBeNull();
  });
  it('rejects malformed codes', () => {
    expect(verifyTotp(secret, '12345')).toBeNull();
    expect(verifyTotp(secret, 'abcdef')).toBeNull();
  });
});
