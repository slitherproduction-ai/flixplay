import { parseM3uPlaylist } from "@/services/xtream";

describe("parseM3uPlaylist", () => {
  it("retains IPTV metadata and ignores duplicate streams", () => {
    const entries = parseM3uPlaylist(`#EXTM3U\n#EXTINF:-1 tvg-id="canal.1" tvg-logo="https://logo" group-title="Noticias" tvg-chno="12",Canal 1\nhttps://example.test/live/1.m3u8\n#EXTINF:-1 tvg-id="canal.1",Duplicado\nhttps://example.test/live/1.m3u8`);
    expect(entries).toEqual([{ id: "canal.1", tvgId: "canal.1", name: "Canal 1", logo: "https://logo", group: "Noticias", number: "12", url: "https://example.test/live/1.m3u8" }]);
  });

  it("keeps declared Catch-up metadata without enabling it for unsupported channels", () => {
    const [entry] = parseM3uPlaylist('#EXTINF:-1 catchup="append" catchup-days="2" catchup-source="https://archive.test/?utc={utc}&duration={duration}",Arquivo\nhttps://example.test/live/2.m3u8');
    expect(entry.catchupDays).toBe(2);
    expect(entry.catchupSource).toBe("https://archive.test/?utc={utc}&duration={duration}");
  });
});
