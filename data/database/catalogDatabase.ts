import { NativeModules, Platform } from "react-native";

export type CatalogKind =
  | "liveCategories"
  | "liveChannels"
  | "vodCategories"
  | "vodMovies"
  | "seriesCategories"
  | "seriesList"
  | "epg";

type NativeCatalogDatabase = {
  replaceAll(serverId: string, kind: CatalogKind, json: string): Promise<number>;
  upsert(serverId: string, kind: CatalogKind, json: string): Promise<number>;
  getPage(serverId: string, kind: CatalogKind, offset: number, limit: number): Promise<string>;
  queryPage?(serverId: string, kind: CatalogKind, offset: number, limit: number): Promise<string>;
  filteredPage?(
    serverId: string, kind: CatalogKind, categoryName: string, query: string, sort: string,
    offset: number, limit: number,
  ): Promise<string>;
  searchPage(serverId: string, query: string, kinds: CatalogKind[], offset: number, limit: number): Promise<string>;
  count(serverId: string, kind: CatalogKind): Promise<number>;
  clearServer(serverId: string): Promise<void>;
  clearAll(): Promise<void>;
  getApproximateSize(): Promise<number>;
};

const nativeDatabase = NativeModules.FlixPlayCatalogDatabase as
  | NativeCatalogDatabase
  | undefined;

function database(): NativeCatalogDatabase | null {
  if (Platform.OS !== "android") return null;
  // The catalog cache is an optimisation. A build without the optional native
  // module must keep loading the provider catalog from the network instead of
  // aborting the whole content flow.
  return nativeDatabase ?? null;
}

const SENSITIVE_CATALOG_KEYS = new Set([
  "authorization",
  "catchupsource",
  "password",
  "playbackurl",
  "serverurl",
  "sourceurl",
  "streamurl",
  "token",
  "url",
  "username",
]);

/**
 * Produces the server-scoped cache payload without playback URLs or credentials.
 * Artwork fields (logo, poster, backdrop and thumbnail) remain cacheable because
 * they are public catalog metadata and do not grant access to the IPTV account.
 */
export function prepareCatalogItemsForPersistence<T>(items: T[]): T[] {
  const sanitize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sanitize);
    if (!value || typeof value !== "object") return value;

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !SENSITIVE_CATALOG_KEYS.has(key.toLowerCase()))
        .map(([key, nestedValue]) => [key, sanitize(nestedValue)]),
    );
  };

  return sanitize(items) as T[];
}

export type IndexedCatalogItem<T> = { kind: CatalogKind; item: T };

export const catalogDatabase = {
  supportsFilteredPage(): boolean {
    return Boolean(database()?.filteredPage);
  },
  async replaceAll<T>(serverId: string, kind: CatalogKind, items: T[]): Promise<void> {
    if (items.length === 0) return;
    await database()?.replaceAll(
      serverId,
      kind,
      JSON.stringify(prepareCatalogItemsForPersistence(items)),
    );
  },

  async upsert<T>(serverId: string, kind: CatalogKind, items: T[]): Promise<void> {
    if (items.length === 0) return;
    await database()?.upsert(
      serverId,
      kind,
      JSON.stringify(prepareCatalogItemsForPersistence(items)),
    );
  },

  async getPage<T>(serverId: string, kind: CatalogKind, offset = 0, limit = 200): Promise<T[]> {
    const value = await database()?.getPage(serverId, kind, offset, limit);
    return value ? (JSON.parse(value) as T[]) : [];
  },

  async queryPage<T>(serverId: string, kind: CatalogKind, offset = 0, limit = 200): Promise<T[]> {
    const db = database();
    const value = db
      ? await (db.queryPage?.(serverId, kind, offset, limit) ?? db.getPage(serverId, kind, offset, limit))
      : undefined;
    return value ? (JSON.parse(value) as T[]) : [];
  },

  async filteredPage<T>(
    serverId: string,
    kind: CatalogKind,
    options: { categoryName?: string; query?: string; sort?: "rating_desc" | "name_desc" | "name_asc" | "added_desc" | "channel_number" } = {},
    offset = 0,
    limit = 80,
  ): Promise<T[]> {
    const db = database();
    if (!db?.filteredPage) return [];
    const value = await db.filteredPage(
      serverId, kind, options.categoryName ?? "", options.query ?? "", options.sort ?? "name_asc", offset, limit,
    );
    return value ? (JSON.parse(value) as T[]) : [];
  },

  async searchPage<T>(
    serverId: string,
    query: string,
    kinds: CatalogKind[],
    options: { offset?: number; limit?: number } = {},
  ): Promise<IndexedCatalogItem<T>[]> {
    if (kinds.length === 0 || query.trim().length === 0) return [];
    const value = await database()?.searchPage(
      serverId,
      query,
      kinds,
      options.offset ?? 0,
      options.limit ?? 200,
    );
    return value ? (JSON.parse(value) as IndexedCatalogItem<T>[]) : [];
  },

  async count(serverId: string, kind: CatalogKind): Promise<number> {
    return (await database()?.count(serverId, kind)) ?? 0;
  },

  async clearServer(serverId: string): Promise<void> {
    await database()?.clearServer(serverId);
  },

  async clearAll(): Promise<void> {
    await database()?.clearAll();
  },

  async getApproximateSize(): Promise<number> {
    return (await database()?.getApproximateSize()) ?? 0;
  },
};
