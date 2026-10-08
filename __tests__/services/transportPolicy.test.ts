import { getSafeTransportCandidates } from "@/services/xtream";

describe("Xtream transport policy", () => {
  it("never downgrades an HTTPS endpoint to HTTP", () => {
    const source = "https://iptv.example:8443/player_api.php?username=a&password=b";
    expect(getSafeTransportCandidates(source)).toEqual([source]);
    expect(getSafeTransportCandidates(source).some((candidate) => candidate.startsWith("http://")))
      .toBe(false);
  });

  it("may upgrade an explicitly configured HTTP endpoint", () => {
    const source = "http://iptv.example:8080/player_api.php";
    expect(getSafeTransportCandidates(source)).toEqual([
      source,
      "https://iptv.example:8080/player_api.php",
    ]);
  });

  it("does not alter an unsupported or relative address", () => {
    expect(getSafeTransportCandidates("iptv.example/player_api.php")).toEqual([
      "iptv.example/player_api.php",
    ]);
  });
});
