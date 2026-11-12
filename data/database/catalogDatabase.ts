import { waitForCatalogIdle } from "@/core/navigation/tv-catalog-activity";
import { NativeModules, Platform } from "react-native";


export type TvQuery = { category?: string; categoryId?: string; hidden?: string[]; ids?: string[]; titles?: string[]; query?: string; sort?: "added_desc" | "rating_desc" | "name_desc" | "name_asc"; counts?: boolean };

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
  searchTvCatalog?(server: string, query: string, kinds: string, offset: number, limit: number): Promise<string>;
  catalogPage?(serverId: string, kind: CatalogKind, options: string, offset: number, limit: number): Promise<string>;
  replaceAll(serverId: string, kind: CatalogKind, json: string): Promise<number>;
  append?(serverId: string, kind: CatalogKind, json: string): Promise<number>;
  commitStaging?(serverId: string, kind: CatalogKind): Promise<number>;
  streamCatalog?(
    requestId: string, serverId: string, kind: CatalogKind, url: string, timeoutMs: number, categories: string, allowEmpty: boolean,
  ): Promise<NativeStreamResult | number>;
  catalogStreamProgress?(requestId: string): Promise<number>;
  cancelCatalogStream?(requestId: string): void;
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
const WRITE_CHUNK_SIZE = 400;
const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function encodeChunk<T>(items: T[]): string {
  return JSON.stringify(prepareCatalogItemsForPersistence(items));
}

const pendingSnapshots = new Map<string, Promise<void>>();

type NativeStreamResult = { count: number; committed: boolean; totalMs: number; writeMs: number; commitMs: number };

/** Resultado da sincronização nativa, para o Diagnóstico → Desempenho. */
export type TvStreamResult = { total: number; writeMs: number | null };

/** O servidor mandou algo que o leitor nativo não entende: vale tentar pelo caminho em JS. */
export class NativeStreamUnsupportedError extends Error {
  constructor(public readonly code: string) {
    super(`Leitura nativa indisponível (${code})`);
    this.name = "NativeStreamUnsupportedError";
  }
}

const NATIVE_STREAM_MESSAGES: Record<string, string> = {
  TIMEOUT: "O servidor demorou demais para responder. O catálogo salvo foi mantido.",
  NETWORK: "Falha de rede ao baixar o catálogo. O catálogo salvo foi mantido.",
};

function nativeStreamError(error: unknown): Error {
  const code = String((error as { code?: unknown })?.code ?? "");
  if (code === "INVALID_JSON" || code === "INVALID_KIND" || code === "DB_UNAVAILABLE" || code === "") {
    return new NativeStreamUnsupportedError(code || "UNKNOWN");
  }
  if (code.startsWith("HTTP_")) return new Error(`O servidor recusou a lista (HTTP ${code.slice(5)}). O catálogo salvo foi mantido.`);
  return new Error(NATIVE_STREAM_MESSAGES[code] ?? "Não foi possível baixar o catálogo. O catálogo salvo foi mantido.");
}

export const catalogDatabase = {
  async writeTvSnapshot<Raw, Item extends { id: string }>(
    server: string, kind: "vodMovies" | "seriesList", rows: Raw[],
    mapItem: (row: Raw) => Item, current: () => boolean,
  ): Promise<void> {
    const db = database();
    if (!db?.append || !db.commitStaging) throw new Error("Gravação por páginas indisponível");
    const key = JSON.stringify([server, kind]);
    const previous = pendingSnapshots.get(key);
    const write = async () => {
      if (!current()) return;
      const stage = `${kind}::staging` as CatalogKind;
      await db.replaceAll(server, stage, "[]");
      for (let i = 0; i < rows.length; i += WRITE_CHUNK_SIZE) {
        await waitForCatalogIdle(current);
        if (!current()) return;
        const chunk = rows.slice(i, i + WRITE_CHUNK_SIZE).map(mapItem).filter(item => item.id.trim());
        await db.append!(server, stage, encodeChunk(chunk));
        await yieldToUi();
      }
      if (current()) await db.commitStaging!(server, kind);
    };
    const job = (previous ?? Promise.resolve()).then(write, write);
    pendingSnapshots.set(key, job);
    try { await job; }
    finally { if (pendingSnapshots.get(key) === job) pendingSnapshots.delete(key); }
  },

  /**
   * Igual a `writeTvSnapshot`, mas a lista chega em partes (uma por categoria):
   * o catálogo inteiro nunca fica na memória de uma vez. `produce` chama
   * `append` a cada parte; ao final, a área temporária só substitui a lista
   * gravada se `shouldCommit(total)` aprovar. Devolve o total gravado.
   */
  async writeTvSnapshotParts<Item extends { id: string }>(
    server: string, kind: "vodMovies" | "seriesList",
    produce: (append: (items: Item[]) => Promise<void>) => Promise<void>,
    current: () => boolean, shouldCommit: (total: number) => boolean,
  ): Promise<number> {
    const db = database();
    if (!db?.append || !db.commitStaging) throw new Error("Gravação por páginas indisponível");
    const key = JSON.stringify([server, kind]);
    const previous = pendingSnapshots.get(key);
    let total = 0;
    const write = async () => {
      if (!current()) return;
      const stage = `${kind}::staging` as CatalogKind;
      await db.replaceAll(server, stage, "[]");
      await produce(async (items) => {
        for (let i = 0; i < items.length; i += WRITE_CHUNK_SIZE) {
          await waitForCatalogIdle(current);
          if (!current()) return;
          const chunk = items.slice(i, i + WRITE_CHUNK_SIZE).filter(item => item.id.trim());
          await db.append!(server, stage, encodeChunk(chunk));
          total += chunk.length;
          await yieldToUi();
        }
      });
      if (current() && shouldCommit(total)) await db.commitStaging!(server, kind);
      else await db.replaceAll(server, stage, "[]").catch(() => 0);
    };
    const job = (previous ?? Promise.resolve()).then(write, write);
    pendingSnapshots.set(key, job);
    try { await job; }
    finally { if (pendingSnapshots.get(key) === job) pendingSnapshots.delete(key); }
    return total;
  },

  /** Sincronização nativa disponível (TV com banco por páginas e módulo novo). */
  supportsNativeStream(): boolean {
    const db = database();
    return !!db?.streamCatalog && !!db.catalogStreamProgress && !!db.commitStaging && this.supportsTvPages();
  },

  /**
   * Baixa e grava filmes ou séries inteiramente no Android (CatalogStreamJob):
   * o JS só acompanha o progresso. A lista gravada só é trocada se
   * `shouldCommit(total)` aprovar. Devolve o total novo (0 se cancelado).
   */
  async streamTvCatalog(
    server: string, kind: "vodMovies" | "seriesList", url: string, timeoutMs: number,
    categories: Record<string, string>, current: () => boolean,
    onProgress: (count: number) => void, shouldCommit: (total: number) => boolean,
  ): Promise<TvStreamResult> {
    const db = database();
    if (!db?.streamCatalog || !db.catalogStreamProgress || !db.commitStaging) throw new NativeStreamUnsupportedError("MISSING");
    const key = JSON.stringify([server, kind]);
    const previous = pendingSnapshots.get(key);
    let total = 0;
    let writeMs: number | null = null;
    let failure = null as Error | null;
    const write = async () => {
      if (!current()) return;
      const requestId = `${kind}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const poll = setInterval(() => {
        if (!current()) { db.cancelCatalogStream?.(requestId); return; }
        void db.catalogStreamProgress!(requestId).then((count) => { if (count >= 0) onProgress(count); }).catch(() => undefined);
      }, 1_000);
      try {
        // A troca da lista (commit) agora acontece no próprio Android, na
        // thread da sincronização: só com itens novos ou se a lista podia ficar vazia.
        const raw = await db.streamCatalog!(requestId, server, kind, url, timeoutMs, JSON.stringify(categories), shouldCommit(0));
        const result: NativeStreamResult = typeof raw === "number"
          ? { count: raw, committed: false, totalMs: 0, writeMs: -1, commitMs: 0 }
          : raw;
        total = result.count;
        writeMs = result.writeMs >= 0 ? result.writeMs + result.commitMs : null;
        if (!result.committed) {
          if (current() && shouldCommit(result.count) && typeof raw === "number") await db.commitStaging!(server, kind);
          else await db.replaceAll(server, `${kind}::staging` as CatalogKind, "[]").catch(() => 0);
        }
      } catch (error) {
        if (current() && String((error as { code?: unknown })?.code ?? "") !== "CANCELLED") failure = nativeStreamError(error);
      } finally {
        clearInterval(poll);
      }
    };
    const job = (previous ?? Promise.resolve()).then(write, write);
    pendingSnapshots.set(key, job);
    try { await job; }
    finally { if (pendingSnapshots.get(key) === job) pendingSnapshots.delete(key); }
    if (failure) throw failure;
    return { total, writeMs };
  },

  async searchTv<T>(server: string, query: string, kinds: CatalogKind[], offset: number, limit: number): Promise<IndexedCatalogItem<T>[]> {
    const raw = await database()?.searchTvCatalog?.(server, query, JSON.stringify(kinds), offset, limit);
    return raw ? JSON.parse(raw) : [];
  },
  supportsTvPages(): boolean { return !!database()?.catalogPage && Platform.isTV; },

  async tvPage<T>(serverId: string, kind: CatalogKind, options: TvQuery, offset = 0, limit = 80): Promise<T[]> {
    const db = database();
    if (!db?.catalogPage) throw new Error("Consulta ao catálogo indisponível");
    return JSON.parse(await db.catalogPage(serverId, kind, JSON.stringify(options), offset, limit)) as T[];
  },

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
      await db.replaceAll(serverId, kind, encodeChunk(items));
      return;
    }
    // Com commitStaging, as partes vão para uma área temporária e só substituem
    // o catálogo salvo no fim: uma gravação interrompida não deixa meia lista.
    const staged = typeof db.commitStaging === "function";
    const target = (staged ? `${kind}::staging` : kind) as CatalogKind;
    await db.replaceAll(serverId, target, encodeChunk(items.slice(0, WRITE_CHUNK_SIZE)));
    for (let start = WRITE_CHUNK_SIZE; start < items.length; start += WRITE_CHUNK_SIZE) {
      await yieldToUi();
      await db.append(serverId, target, encodeChunk(items.slice(start, start + WRITE_CHUNK_SIZE)));
    }
    if (staged) await db.commitStaging?.(serverId, kind);
  },

  async upsert<T>(serverId: string, kind: CatalogKind, items: T[]): Promise<void> {
    if (items.length === 0) return;
    const db = database();
    if (db?.append && db.catalogPage) {
      for (let i = 0; i < items.length; i += WRITE_CHUNK_SIZE) {
        await db.append(serverId, kind, encodeChunk(items.slice(i, i + WRITE_CHUNK_SIZE)));
        await yieldToUi();
      }
      return;
    }
    if (typeof db?.upsert !== "function") return;
    await db.upsert(
      serverId,
      kind,
      encodeChunk(items),
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
