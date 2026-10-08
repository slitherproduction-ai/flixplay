import {
  EMPTY_SERVER_USER_DATA,
  getServerUserData,
  migrateLegacyServerUserData,
  updateServerUserData,
  withoutServerUserData,
} from "@/store/serverScopedData";

describe("server-scoped user data", () => {
  it("keeps favorites isolated between servers", () => {
    const withFirst = updateServerUserData({}, "one", (data) => ({
      ...data,
      favoriteMovieIds: ["movie-1"],
    }));
    const withBoth = updateServerUserData(withFirst, "two", (data) => ({
      ...data,
      favoriteMovieIds: ["movie-2"],
    }));

    expect(getServerUserData(withBoth, "one").favoriteMovieIds).toEqual(["movie-1"]);
    expect(getServerUserData(withBoth, "two").favoriteMovieIds).toEqual(["movie-2"]);
  });

  it("assigns legacy data only to the active server during migration", () => {
    const migrated = migrateLegacyServerUserData(undefined, "active", {
      favoriteChannelIds: ["live-1"],
      history: [{ contentId: "movie-1", type: "movie", title: "A", subtitle: "", thumbnail: "", positionMs: 0, durationMs: 1, updatedAt: "2026-10-04" }],
    });

    expect(getServerUserData(migrated, "active").favoriteChannelIds).toEqual(["live-1"]);
    expect(getServerUserData(migrated, "active").history[0].serverId).toBe("active");
    expect(getServerUserData(migrated, "other")).toEqual(EMPTY_SERVER_USER_DATA);
  });

  it("removes only the selected server data", () => {
    const data = {
      first: { ...EMPTY_SERVER_USER_DATA, favoriteIds: ["a"] },
      second: { ...EMPTY_SERVER_USER_DATA, favoriteIds: ["b"] },
    };
    expect(withoutServerUserData(data, "first")).toEqual({ second: data.second });
  });

  it("keeps protected content isolated between servers", () => {
    const first = updateServerUserData({}, "one", (data) => ({ ...data, blockedContentIds: ["movie-1"] }));
    const both = updateServerUserData(first, "two", (data) => ({ ...data, blockedContentIds: ["movie-2"] }));
    expect(getServerUserData(both, "one").blockedContentIds).toEqual(["movie-1"]);
    expect(getServerUserData(both, "two").blockedContentIds).toEqual(["movie-2"]);
  });
});
