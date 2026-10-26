import { parseSeriesEpisodes } from "@/features/details/seriesEpisodes";

const profile = { serverUrl: "http://iptv.example.com", username: "user", password: "pass" };

describe("series episode parsing", () => {
  it("orders seasons, preserves episode identity and forwards explicit intro metadata", () => {
    const result = parseSeriesEpisodes({
      episodes: {
        "2": [{ id: 202, episode_num: 1, title: "Segundo", info: { duration_secs: 1_200 } }],
        "1": [{ id: 101, episode_num: 3, title: "Primeiro", info: { intro_end_seconds: 85 } }],
      },
    }, "series-1", profile);

    expect(result.seasonsCount).toBe(2);
    expect(result.episodes.map((episode) => episode.id)).toEqual(["ep-series-1-s1-e3", "ep-series-1-s2-e1"]);
    expect(result.episodes[0]).toMatchObject({ duration: "N/A", introEndSeconds: 85 });
  });
});
