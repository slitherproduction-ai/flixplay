import type { SecureStorageStatus } from "@/services/security/secureStorage";

export type StartupScreen = "loading" | "recovery" | "ready";

/**
 * Keeps startup decisions deterministic. A failed secure vault must never be
 * presented as a successful hydration, and an unresponsive bridge must always
 * expose a recovery path instead of an infinite spinner.
 */
export function getStartupScreen(input: {
  hydrated: boolean;
  timedOut: boolean;
  secureStorageStatus: SecureStorageStatus;
}): StartupScreen {
  if (input.secureStorageStatus === "failed" || input.timedOut) return "recovery";
  return input.hydrated ? "ready" : "loading";
}
