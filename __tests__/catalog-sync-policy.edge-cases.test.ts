import {
  assertSafeCatalogReplacement,
  UnexpectedEmptyCatalogError,
} from "@/data/sync/catalogSyncPolicy";

describe("catalog synchronization policy edge cases", () => {
  it.each([
    ["liveCategories", 12],
    ["vodCategories", 18],
    ["vodMovies", 12_000],
    ["seriesCategories", 8],
    ["seriesList", 4_500],
  ] as const)("protects an existing %s catalog from an empty response", (kind, existing) => {
    expect(() => assertSafeCatalogReplacement(kind, 0, existing)).toThrow(
      UnexpectedEmptyCatalogError,
    );
  });

  it.each([
    "liveCategories",
    "vodCategories",
    "vodMovies",
    "seriesCategories",
    "seriesList",
  ] as const)("allows an optional empty %s catalog on the first synchronization", (kind) => {
    expect(() => assertSafeCatalogReplacement(kind, 0, 0)).not.toThrow();
  });

  it("always treats an empty live-channel response as unexpected", () => {
    for (const existing of [0, 1, 30_000]) {
      try {
        assertSafeCatalogReplacement("liveChannels", 0, existing);
        throw new Error("expected policy to reject the empty response");
      } catch (error) {
        expect(error).toBeInstanceOf(UnexpectedEmptyCatalogError);
        expect((error as UnexpectedEmptyCatalogError).kind).toBe("liveChannels");
        expect((error as Error).name).toBe("UnexpectedEmptyCatalogError");
      }
    }
  });

  it.each([1, 5_000, 15_000, 30_000, 50_000])(
    "accepts a non-empty replacement with %,d items",
    (incoming) => {
      expect(() =>
        assertSafeCatalogReplacement("liveChannels", incoming, 50_000),
      ).not.toThrow();
    },
  );
});
