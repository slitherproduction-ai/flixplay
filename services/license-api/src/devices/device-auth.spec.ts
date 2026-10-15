import { describe, expect, it } from 'vitest';
import { createDeviceSecret, sha256, verifyDeviceSecret, pairingCode, publicDeviceCode } from './device-auth';

describe('device credentials', () => {
  it('accepts a generated device secret and rejects another', () => {
    const secret = createDeviceSecret();
    const hash = sha256(secret);
    expect(() => verifyDeviceSecret('Bearer ' + secret, hash)).not.toThrow();
    expect(() => verifyDeviceSecret('Bearer ' + createDeviceSecret(), hash)).toThrow();
  });
  it('generates nonempty opaque identifiers', () => {
    expect(publicDeviceCode()).toMatch(/^[0-9A-F]{16}$/);
    expect(pairingCode()).toMatch(/^\d{8}$/);
  });
});
