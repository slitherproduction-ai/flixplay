import { isPlaybackBlocked } from "@/services/security/parentalPolicy";

describe("isPlaybackBlocked", () => {
  it("allows content that is not protected", () => {
    expect(isPlaybackBlocked("movie-1", undefined, () => false)).toBe(false);
  });

  it("blocks an item explicitly marked as protected", () => {
    expect(isPlaybackBlocked("movie-1", undefined, (id) => id === "movie-1")).toBe(true);
  });

  it("inherits a series lock for an episode", () => {
    expect(isPlaybackBlocked("ep-series-7-s1-e2", "series-7", (id) => id === "series-7")).toBe(true);
  });

  it("does not treat an empty parent id as a lock", () => {
    expect(isPlaybackBlocked("episode-1", "", (id) => id === "")).toBe(false);
  });
});
