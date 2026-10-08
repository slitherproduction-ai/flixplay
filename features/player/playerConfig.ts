import type { Preferences } from "@/store/types";
import {
  buildFallbackUrls,
  type StreamPreference,
} from "@/features/player/StreamResolver";

export { buildFallbackUrls };
export type { StreamPreference };

export const DEFAULT_PLAYER_USER_AGENT = "ELVANOQ/2.16 (Android Media Player)";

export type PlayerPreferences = {
  osdTimeoutMs: 3000 | 5000 | 7000;
  seekStepSeconds: 10 | 30 | 60;
  streamPreference: StreamPreference;
  userAgent: string;
};

function oneOf<T extends string | number>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export function readPlayerPreferences(preferences: Preferences): PlayerPreferences {
  const rawAgent = typeof preferences.playerUserAgent === "string"
    ? preferences.playerUserAgent.trim()
    : "";
  return {
    osdTimeoutMs: oneOf(preferences.osdTimeoutMs, [3000, 5000, 7000] as const, 5000),
    seekStepSeconds: oneOf(preferences.seekStepSeconds, [10, 30, 60] as const, 10),
    streamPreference: oneOf(preferences.streamPreference, ["auto", "hls", "ts"] as const, "auto"),
    userAgent: rawAgent.slice(0, 160) || DEFAULT_PLAYER_USER_AGENT,
  };
}

export function buildPlayerHeaders(userAgent: string): Record<string, string> {
  return { "User-Agent": userAgent.replace(/[\r\n]/g, " ").trim() || DEFAULT_PLAYER_USER_AGENT };
}

export function nextChannelNumberInput(current: string, digit: number): string {
  if (!Number.isInteger(digit) || digit < 0 || digit > 9) return current;
  return `${current}${digit}`.replace(/^0+(?=\d)/, "").slice(-4);
}
