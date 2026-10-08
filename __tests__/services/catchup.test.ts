import { buildCatchupUrl } from "@/services/catchup";
import type { ChannelItem, EpgProgram, ServerProfile } from "@/store/types";

const program: EpgProgram = {
  title: "Jornal", start: "10:00", end: "11:00", progress: 100,
  startTimestamp: 1_700_000_000_000, endTimestamp: 1_700_003_600_000,
};
const channel: ChannelItem = {
  id: "channel-7", name: "Canal 7", number: "7", streamId: "7", logo: "", categoryId: "1", categoryName: "Geral",
  currentEpg: program, nextProgram: "", streamUrl: "https://stream/live.m3u8", catchupDays: 3,
};
const profile: ServerProfile = {
  id: "server", name: "Servidor", serverUrl: "https://provider.test", username: "user", password: "pass", isActive: true,
  expiryDate: "", maxConnections: null, activeConnections: null, format: "M3U8",
};

describe("Catch-up", () => {
  it("does not invent archive playback when the provider did not advertise it", () => {
    expect(buildCatchupUrl({ ...channel, catchupDays: undefined }, profile, program)).toBeNull();
  });

  it("builds the Xtream archive URL only for a completed programme", () => {
    expect(buildCatchupUrl(channel, profile, program)).toBe(
      "https://provider.test/timeshift/user/pass/60/1700000000/7.m3u8",
    );
  });

  it("resolves a declared M3U catchup template", () => {
    expect(buildCatchupUrl(
      { ...channel, catchupSource: "https://archive.test/play?start={utc}&duration={duration}" },
      { ...profile, sourceType: "m3u", m3uUrl: "https://playlist.test/list.m3u" },
      program,
    )).toBe("https://archive.test/play?start=1700000000&duration=60");
  });
});
