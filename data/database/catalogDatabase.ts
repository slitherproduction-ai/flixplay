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
  queryPage(serverId: string, kind: CatalogKind, offset: number, limit: number): Promise<string>;
  clearServer(serverId: string): Promise<void>;
  clearAll(): Promise<void>;
  getApproximateSize(): Promise<number>;
};

const nativeDatabase = NativeModules.FlixPlayCatalogDatabase as
  | NativeCatalogDatabase
  | undefined;

const SENSITIVE_FIELDS = new Set(["streamurl", "url", "username", "user", "password", "pass", "passwd", "pwd", "token", "authorization", "access_token", "refresh_token", "api_key", "secret", "pin", "cookie", "session", "sessionid"]);

function stripSensitiveFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripSensitiveFields);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !SENSITIVE_FIELDS.has(key.toLowerCase()))
    .map(([key, child]) => [key, stripSensitiveFields(child)]));
}

export function prepareCatalogItemsForPersistence<T>(items: T[]): T[] {
  return items.map((item) => stripSensitiveFields(item) as T);
}

function database(): NativeCatalogDatabase | null {
  if (Platform.OS !== "android") return null;
  if (!nativeDatabase && !__DEV__) throw new Error("Banco local indisponível nesta instalação.");
  return nativeDatabase ?? null;
}

export const catalogDatabase = {
  async replaceAll<T>(serverId: string, kind: CatalogKind, items: T[]): Promise<void> {
    await database()?.replaceAll(serverId, kind, JSON.stringify(prepareCatalogItemsForPersistence(items)));
  },

  async queryPage<T>(serverId: string, kind: CatalogKind, offset = 0, limit = 200): Promise<T[]> {
    const value = await database()?.queryPage(serverId, kind, offset, limit);
    return value ? (JSON.parse(value) as T[]) : [];
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
