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

function database(): NativeCatalogDatabase | null {
  if (Platform.OS !== "android") return null;
  if (!nativeDatabase && !__DEV__) throw new Error("Banco local indisponível nesta instalação.");
  return nativeDatabase ?? null;
}

export const catalogDatabase = {
  async replaceAll<T>(serverId: string, kind: CatalogKind, items: T[]): Promise<void> {
    await database()?.replaceAll(serverId, kind, JSON.stringify(items));
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
