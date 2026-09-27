import { mapLiveStreamToChannel, parseM3uPlaylist } from "@/services/xtream";
import type { ServerProfile } from "@/store/types";

const profile: ServerProfile = {
  id: "test-server",
  name: "Teste",
  serverUrl: "http://example.test:8080",
  username: "user",
  password: "password",
  isActive: true,
  expiryDate: "Não informado",
  maxConnections: null,
  activeConnections: null,
  format: null,
};

describe("large catalogs", () => {
  it("maps 30,000 live channels without truncation", () => {
    const channels = Array.from({ length: 30_000 }, (_, index) =>
      mapLiveStreamToChannel(
        { stream_id: index + 1, name: `Canal ${index + 1}`, stream_icon: "", category_id: "1", tv_archive: 0 },
        { category_id: "1", category_name: "Geral", parent_id: 0 },
        profile,
      ),
    );
    expect(channels).toHaveLength(30_000);
    expect(new Set(channels.map((channel) => channel.id)).size).toBe(30_000);
  });

  it("parses a 30,000 item M3U playlist without an artificial limit", () => {
    const playlist = ["#EXTM3U", ...Array.from({ length: 30_000 }, (_, index) => [
      `#EXTINF:-1 tvg-id=\"id-${index}\" group-title=\"Geral\",Canal ${index}`,
      `http://example.test/live/${index}.ts`,
    ]).flat()].join("\n");
    expect(parseM3uPlaylist(playlist)).toHaveLength(30_000);
  });
});
