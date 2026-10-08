import {
  getParentalLockDurationMs,
  isParentalLockActive,
  isParentalSessionUnlocked,
  isValidParentalPin,
  requiresParentalUnlock,
} from "@/services/security/parentalPolicy";
import {
  isNativeParentalControlAvailable,
  setParentalPin,
} from "@/services/security/parentalControl";

describe("parental-control policy", () => {
  it("accepts only a 4-to-8 digit PIN", () => {
    expect(isValidParentalPin("1234")).toBe(true);
    expect(isValidParentalPin("12345678")).toBe(true);
    expect(isValidParentalPin("123")).toBe(false);
    expect(isValidParentalPin("123456789")).toBe(false);
    expect(isValidParentalPin("12a4")).toBe(false);
  });

  it("applies a bounded progressive lockout after five failures", () => {
    expect(getParentalLockDurationMs(4)).toBe(0);
    expect(getParentalLockDurationMs(5)).toBe(30_000);
    expect(getParentalLockDurationMs(6)).toBe(60_000);
    expect(getParentalLockDurationMs(20)).toBe(30 * 60_000);
  });

  it("evaluates lock and unlock-session time using an explicit clock", () => {
    const now = 1_000_000;
    expect(isParentalLockActive(now + 1, now)).toBe(true);
    expect(isParentalLockActive(now, now)).toBe(false);
    expect(isParentalSessionUnlocked(now - 4 * 60_000, 5, now)).toBe(true);
    expect(isParentalSessionUnlocked(now - 5 * 60_000, 5, now)).toBe(false);
    expect(requiresParentalUnlock(true, now - 5 * 60_000, 5, now)).toBe(true);
    expect(requiresParentalUnlock(false, null, 5, now)).toBe(false);
  });

  it("fails closed instead of persisting a PIN insecurely without the native vault", async () => {
    if (isNativeParentalControlAvailable()) return;
    await expect(setParentalPin("1234")).rejects.toThrow(
      "Controle parental seguro indisponível",
    );
  });
});
