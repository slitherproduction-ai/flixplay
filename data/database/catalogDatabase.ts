import { NativeModules, Platform } from "react-native";

export type CatalogKind =
  | "liveCategories"
  | "liveChannels"
  | "vodCategories"
  | "vodMovies"
  | "seriesCategories"
  | "seriesList"
  | "epg";

// Métodos opcionais: o app precisa continuar funcionando com qualquer versão
// do módulo nativo, inclusive sem ele (sem cache, só a rede).
type NativeCatalogDatabase = {
  replaceAll(serverId: string, kind: CatalogKind, json: string): Promise<number>;
  append?(serverId: string, kind: CatalogKind, json: string): Promise<number>;
  upsert?(serverId: string, kind: CatalogKind, json: string): Promise<number>;
  getPage?(serverId: string, kind: CatalogKind, offset: number, limit: number): Promise<string>;
  queryPage?(serverId: string, kind: CatalogKind, offset: number, limit: number): Promise<string>;
  filteredPage?(
    serverId: string, kind: CatalogKind, categoryName: string, query: string, sort: string,
    offset: number, limit: number,
  ): Promise<string>;
  searchPage?(serverId: string, query: string, kinds: CatalogKind[], offset: number, limit: number): Promise<string>;
  count?(serverId: string, kind: CatalogKind): Promise<number>;
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

/** Itens por gravação: cada parte vira um JSON de ~1–2 MB em vez de um único de dezenas de MB. */
const WRITE_CHUNK_SIZE = 1500;
const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export const catalogDatabase = {
  supportsFilteredPage(): boolean {
    return Boolean(database()?.filteredPage);
  },
  /** O módulo nativo pode não oferecer a busca: a tela de busca usa a memória nesse caso. */
  supportsSearch(): boolean {
    return typeof database()?.searchPage === "function";
  },
  /** O banco local está disponível para restaurar o catálogo na abertura do app. */
  isAvailable(): boolean {
    const db = database();
    return Boolean(db && typeof db.replaceAll === "function" && typeof db.queryPage === "function");
  },

  async replaceAll<T>(serverId: string, kind: CatalogKind, items: T[]): Promise<void> {
    if (items.length === 0) return;
    const db = database();
    if (!db) return;
    // Listas grandes são gravadas em partes, com uma pausa entre elas para a
    // tela continuar respondendo: evita montar um único texto enorme na memória
    // do JavaScript e outro no Android ao mesmo tempo.
    if (typeof db.append !== "function" || items.length <= WRITE_CHUNK_SIZE) {
      await db.replaceAll(serverId, kind, JSON.stringify(prepareCatalogItemsForPersistence(items)));
      return;
    }
    await db.replaceAll(serverId, kind, JSON.stringify(prepareCatalogItemsForPersistence(items.slice(0, WRITE_CHUNK_SIZE))));
    for (let start = WRITE_CHUNK_SIZE; start < items.length; start += WRITE_CHUNK_SIZE) {
      await yieldToUi();
      await db.append(serverId, kind, JSON.stringify(prepareCatalogItemsForPersistence(items.slice(start, start + WRITE_CHUNK_SIZE))));
    }
  },

  async upsert<T>(serverId: string, kind: CatalogKind, items: T[]): Promise<void> {
    if (items.length === 0) return;
    const db = database();
    if (typeof db?.upsert !== "function") return;
    await db.upsert(
      serverId,
      kind,
      JSON.stringify(prepareCatalogItemsForPersistence(items)),
    );
  },

  async getPage<T>(serverId: string, kind: CatalogKind, offset = 0, limit = 200): Promise<T[]> {
    const db = database();
    const value = typeof db?.getPage === "function" ? await db.getPage(serverId, kind, offset, limit) : undefined;
    return value ? (JSON.parse(value) as T[]) : [];
  },

  async queryPage<T>(serverId: string, kind: CatalogKind, offset = 0, limit = 200): Promise<T[]> {
    const db = database();
    const value = db
      ? await (db.queryPage?.(serverId, kind, offset, limit) ?? db.getPage?.(serverId, kind, offset, limit))
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
    const db = database();
    if (typeof db?.searchPage !== "function") return [];
    const value = await db.searchPage(
      serverId,
      query,
      kinds,
      options.offset ?? 0,
      options.limit ?? 200,
    );
    return value ? (JSON.parse(value) as IndexedCatalogItem<T>[]) : [];
  },

  async count(serverId: string, kind: CatalogKind): Promise<number> {
    const db = database();
    if (typeof db?.count !== "function") return 0;
    return (await db.count(serverId, kind)) ?? 0;
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
