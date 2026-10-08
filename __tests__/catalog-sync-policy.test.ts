import { assertSafeCatalogReplacement, UnexpectedEmptyCatalogError } from "@/data/sync/catalogSyncPolicy";

describe("catalog synchronization policy", () => {
  it("rejects an empty live response even on first synchronization", () => {
    expect(() => assertSafeCatalogReplacement("liveChannels", 0, 0)).toThrow(UnexpectedEmptyCatalogError);
  });
  it("preserves a previously valid catalog when a stage returns empty", () => {
    expect(() => assertSafeCatalogReplacement("vodMovies", 0, 1200)).toThrow("catálogo salvo foi preservado");
  });
  it("allows an optional section to be genuinely empty on first sync", () => {
    expect(() => assertSafeCatalogReplacement("seriesList", 0, 0)).not.toThrow();
  });
  it("accepts a non-empty incremental replacement", () => {
    expect(() => assertSafeCatalogReplacement("liveChannels", 5000, 4800)).not.toThrow();
  });
});
