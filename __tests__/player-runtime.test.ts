import { mapPlayerError } from "@/features/player/ErrorMapper";
import {
  decideProgressPersistence,
  shouldResumeAt,
} from "@/features/player/ProgressPolicy";
import { createPlaybackSessionGuard } from "@/features/player/SessionGuard";
import { buildFallbackUrls } from "@/features/player/StreamResolver";

describe("player runtime policies", () => {
  it("changes only the live stream extension and preserves query and hash", () => {
    expect(buildFallbackUrls(
      "https://provider.test/live/u/p/10.ts?token=a.ts#quality",
      "live",
      "hls",
    )).toEqual([
      "https://provider.test/live/u/p/10.m3u8?token=a.ts#quality",
      "https://provider.test/live/u/p/10.ts?token=a.ts#quality",
    ]);
  });

  it("does not invent alternatives for VOD", () => {
    expect(buildFallbackUrls("https://provider.test/movie/10.mp4?x=1", "movie", "hls"))
      .toEqual(["https://provider.test/movie/10.mp4?x=1"]);
  });

  it("persists active playback and removes completed playback", () => {
    expect(decideProgressPersistence(120, 1_000)).toEqual({
      action: "save",
      positionMs: 120_000,
      durationMs: 1_000_000,
    });
    expect(decideProgressPersistence(950, 1_000)).toEqual({ action: "remove" });
    expect(decideProgressPersistence(2, 1_000)).toEqual({ action: "ignore" });
    expect(shouldResumeAt(120, 1_000)).toBe(true);
    expect(shouldResumeAt(950, 1_000)).toBe(false);
  });

  it("maps technical failures to safe user messages", () => {
    const result = mapPlayerError(
      new Error("HTTP 403 https://provider.test/live/private-user/private-password/10.ts"),
    );
    expect(result.kind).toBe("server");
    expect(result.message).not.toContain("provider.test");
    expect(result.message).not.toContain("private-user");
    expect(result.message).not.toContain("private-password");
  });

  it("rejects callbacks from superseded playback sessions", () => {
    const guard = createPlaybackSessionGuard();
    const first = guard.begin();
    expect(guard.isCurrent(first)).toBe(true);
    const second = guard.begin();
    expect(guard.isCurrent(first)).toBe(false);
    expect(guard.isCurrent(second)).toBe(true);
    guard.end(first);
    expect(guard.isCurrent(second)).toBe(true);
    guard.invalidate();
    expect(guard.isCurrent(second)).toBe(false);
  });
});
