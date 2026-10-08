export const PARENTAL_PIN_MIN_LENGTH = 4;
export const PARENTAL_PIN_MAX_LENGTH = 8;
export const PARENTAL_ATTEMPTS_BEFORE_LOCK = 5;
export const PARENTAL_INITIAL_LOCK_MS = 30_000;
export const PARENTAL_MAX_LOCK_MS = 30 * 60_000;

export function isValidParentalPin(pin: string): boolean {
  return /^\d{4,8}$/.test(pin);
}

/** Mirrors the native progressive lockout rule for UI countdowns and tests. */
export function getParentalLockDurationMs(failedAttempts: number): number {
  const normalized = Math.max(0, Math.floor(failedAttempts));
  if (normalized < PARENTAL_ATTEMPTS_BEFORE_LOCK) return 0;
  const exponent = Math.min(16, normalized - PARENTAL_ATTEMPTS_BEFORE_LOCK);
  return Math.min(PARENTAL_INITIAL_LOCK_MS * 2 ** exponent, PARENTAL_MAX_LOCK_MS);
}

export function isParentalLockActive(lockedUntil: number, now = Date.now()): boolean {
  return Number.isFinite(lockedUntil) && lockedUntil > now;
}

export function isParentalSessionUnlocked(
  unlockedAt: number | null,
  timeoutMinutes: number,
  now = Date.now(),
): boolean {
  if (unlockedAt === null || !Number.isFinite(unlockedAt)) return false;
  const timeoutMs = Math.max(0, timeoutMinutes) * 60_000;
  return timeoutMs > 0 && now >= unlockedAt && now - unlockedAt < timeoutMs;
}

export function requiresParentalUnlock(
  protectedContent: boolean,
  unlockedAt: number | null,
  timeoutMinutes: number,
  now = Date.now(),
): boolean {
  return protectedContent && !isParentalSessionUnlocked(unlockedAt, timeoutMinutes, now);
}

/** Episodes inherit the lock applied to their parent series. */
export function isPlaybackBlocked(
  contentId: string,
  seriesId: string | undefined,
  isBlocked: (id: string) => boolean,
): boolean {
  return isBlocked(contentId) || (typeof seriesId === "string" && seriesId.length > 0 && isBlocked(seriesId));
}
