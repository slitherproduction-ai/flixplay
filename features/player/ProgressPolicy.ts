export type ProgressDecision =
  | { action: "ignore" }
  | { action: "remove" }
  | { action: "save"; positionMs: number; durationMs: number };

export function decideProgressPersistence(
  positionSeconds: number,
  durationSeconds: number,
  completionRatio = 0.95,
): ProgressDecision {
  if (
    !Number.isFinite(positionSeconds) ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0 ||
    positionSeconds < 5
  ) {
    return { action: "ignore" };
  }

  const clampedPosition = Math.max(0, Math.min(positionSeconds, durationSeconds));
  if (
    clampedPosition / durationSeconds >= completionRatio ||
    durationSeconds - clampedPosition <= 60
  ) {
    return { action: "remove" };
  }

  return {
    action: "save",
    positionMs: Math.round(clampedPosition * 1000),
    durationMs: Math.round(durationSeconds * 1000),
  };
}

export function shouldResumeAt(positionSeconds: number, durationSeconds: number): boolean {
  return (
    Number.isFinite(positionSeconds) &&
    Number.isFinite(durationSeconds) &&
    positionSeconds >= 5 &&
    durationSeconds > 0 &&
    positionSeconds < durationSeconds * 0.95
  );
}
