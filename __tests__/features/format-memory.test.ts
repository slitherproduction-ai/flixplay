import { detectLiveFormat, effectiveStreamPreference, formatMemoryKey } from "@/features/player/format-memory";
import { buildCatchupCandidates, formatXtreamArchiveStart } from "@/services/catchup";

describe("format-memory", () => {
  it("detecta o formato pelo caminho", () => {
    expect(detectLiveFormat("http://h/live/u/p/1.m3u8?token=1")).toBe("hls");
    expect(detectLiveFormat("http://h/live/u/p/1.ts")).toBe("ts");
    expect(detectLiveFormat("http://h/live/u/p/1")).toBeNull();
  });
  it("a escolha do usuário vence o formato lembrado", () => {
    expect(effectiveStreamPreference("auto", "ts")).toBe("ts");
    expect(effectiveStreamPreference("hls", "ts")).toBe("hls");
    expect(effectiveStreamPreference("auto", "outro")).toBe("auto");
    expect(formatMemoryKey(null)).toBeNull();
  });
});

describe("catch-up candidates", () => {
  it("oferece alternativas para painéis Xtream diferentes", () => {
    const start = Date.UTC(2026, 10, 4, 12, 0);
    const urls = buildCatchupCandidates(
      { id: "c", streamId: 77, catchupDays: 3 } as never,
      { serverUrl: "http://h:80/", username: "u", password: "p", sourceType: "xtream" } as never,
      { startTimestamp: start, endTimestamp: start + 30 * 60_000 } as never,
    );
    expect(urls).toHaveLength(3);
    expect(urls[0]).toBe(`http://h:80/timeshift/u/p/30/${start / 1000}/77.m3u8`);
    expect(urls[2]).toContain("/streaming/timeshift.php?username=u&password=p&stream=77&start=");
    expect(formatXtreamArchiveStart(start)).toMatch(/^\d{4}-\d{2}-\d{2}:\d{2}-\d{2}$/);
  });
});
