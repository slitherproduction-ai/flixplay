export type SyncCatalogKind =
  | "liveCategories"
  | "liveChannels"
  | "vodCategories"
  | "vodMovies"
  | "seriesCategories"
  | "seriesList";

export class UnexpectedEmptyCatalogError extends Error {
  readonly kind: SyncCatalogKind;

  constructor(kind: SyncCatalogKind) {
    super("O servidor retornou uma lista vazia inesperada. O catálogo salvo foi preservado.");
    this.name = "UnexpectedEmptyCatalogError";
    this.kind = kind;
  }
}

export function assertSafeCatalogReplacement(
  kind: SyncCatalogKind,
  incomingCount: number,
  existingCount: number,
): void {
  const liveMustContainChannels = kind === "liveChannels" && incomingCount === 0;
  const wouldEraseValidCatalog = existingCount > 0 && incomingCount === 0;
  if (liveMustContainChannels || wouldEraseValidCatalog) {
    throw new UnexpectedEmptyCatalogError(kind);
  }
}

/**
 * Xtream panels sometimes return the same stream/series more than once,
 * usually because it was associated with multiple categories. The catalog
 * database uses the content id as its stable primary key, so duplicated ids
 * must be collapsed before a replacement transaction starts.
 *
 * Map keeps the position of the first occurrence while the last occurrence
 * refreshes the payload. This gives deterministic ordering and the newest
 * metadata without allocating multiple full catalog copies repeatedly.
 */
export function deduplicateCatalogItems<T>(
  items: T[],
  getId: (item: T) => string,
): T[] {
  const unique = new Map<string, T>();
  for (const item of items) {
    const id = getId(item).trim();
    if (!id) continue;
    unique.set(id, item);
  }
  return unique.size === items.length ? items : Array.from(unique.values());
}
