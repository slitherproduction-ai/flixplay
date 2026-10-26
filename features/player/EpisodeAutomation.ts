export const NEXT_EPISODE_COUNTDOWN_SECONDS = 6;

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function asSeconds(value: unknown): number | null {
  const seconds = typeof value === "number" ? value : Number(value);
  return Number.isFinite(seconds) && seconds > 0 && seconds <= 21_600 ? seconds : null;
}

/** Uses only an explicit provider marker; no generic intro duration is inferred. */
export function readIntroEndSeconds(value: unknown): number | null {
  const record = asRecord(value);
  if (!record) return null;
  return asSeconds(record.intro_end_seconds ?? record.introEndSeconds);
}

export function getIntroSkipTarget(
  currentTime: number,
  duration: number,
  introEndSeconds: number | null,
): number | null {
  if (!introEndSeconds || !Number.isFinite(duration) || duration <= 0) return null;
  const target = Math.min(introEndSeconds, Math.max(0, duration - 2));
  return target > currentTime + 1 ? target : null;
}

export function getNextEpisodeCountdown(
  currentTime: number,
  duration: number,
  canAutoAdvance: boolean,
): number | null {
  if (!canAutoAdvance || !Number.isFinite(duration) || duration <= 0) return null;
  const remaining = duration - currentTime;
  if (remaining <= 0 || remaining > NEXT_EPISODE_COUNTDOWN_SECONDS) return null;
  return Math.max(1, Math.ceil(remaining));
}
