import { prepareCatalogItemsForPersistence } from "@/data/database/catalogDatabase";

describe("catalog database contract", () => {
  it("removes playback URLs and credentials recursively while preserving artwork", () => {
    const [result] = prepareCatalogItemsForPersistence([
      {
        id: "channel-1",
        name: "Canal São Paulo",
        streamUrl: "http://host/live/user/password/1.ts",
        logo: "https://cdn.example/logo.png",
        auth: {
          username: "user",
          password: "password",
          token: "secret",
        },
        currentEpg: { title: "Jornal", description: "Agora" },
      },
    ]);

    expect(result).toEqual({
      id: "channel-1",
      name: "Canal São Paulo",
      logo: "https://cdn.example/logo.png",
      auth: {},
      currentEpg: { title: "Jornal", description: "Agora" },
    });
  });

  it("does not mutate the catalog held by the UI", () => {
    const original = [{ id: "movie-1", title: "Filme", streamUrl: "https://secret/movie.mp4" }];
    const persisted = prepareCatalogItemsForPersistence(original);

    expect(original[0].streamUrl).toBe("https://secret/movie.mp4");
    expect(persisted[0]).not.toHaveProperty("streamUrl");
    expect(persisted).not.toBe(original);
  });

  it("handles an empty page without manufacturing data", () => {
    expect(prepareCatalogItemsForPersistence([])).toEqual([]);
  });
});
