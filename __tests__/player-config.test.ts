import {
  buildFallbackUrls,
  buildPlayerHeaders,
  nextChannelNumberInput,
  readPlayerPreferences,
} from "@/features/player/playerConfig";

describe("player configuration", () => {
  it("normalizes persisted preferences", () => {
    expect(readPlayerPreferences({ osdTimeoutMs: 7000, seekStepSeconds: 30, streamPreference: "ts" }))
      .toMatchObject({ osdTimeoutMs: 7000, seekStepSeconds: 30, streamPreference: "ts" });
    expect(readPlayerPreferences({ osdTimeoutMs: 9000 }).osdTimeoutMs).toBe(5000);
  });

  it("orders live alternatives according to the selected format", () => {
    expect(buildFallbackUrls("http://example/live/1.ts", "live", "hls"))
      .toEqual(["http://example/live/1.m3u8", "http://example/live/1.ts"]);
    expect(buildFallbackUrls("http://example/live/1.m3u8", "live", "ts")[0]).toMatch(/\.ts$/);
  });

  it("sanitizes user agent headers and channel number input", () => {
    expect(buildPlayerHeaders("Agent\r\nInjected")["User-Agent"]).toBe("Agent  Injected");
    expect(nextChannelNumberInput("12", 3)).toBe("123");
  });
});
