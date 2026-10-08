import type { PlayHistory } from "./types";

export interface ServerScopedUserData {
  favoriteIds: string[];
  favoriteChannelIds: string[];
  favoriteMovieIds: string[];
  favoriteSeriesIds: string[];
  history: PlayHistory[];
  blockedContentIds: string[];
}

export type UserDataByServer = Record<string, ServerScopedUserData>;

export const EMPTY_SERVER_USER_DATA: ServerScopedUserData = {
  favoriteIds: [],
  favoriteChannelIds: [],
  favoriteMovieIds: [],
  favoriteSeriesIds: [],
  history: [],
  blockedContentIds: [],
};

export function getServerUserData(data: UserDataByServer, serverId: string): ServerScopedUserData {
  return data[serverId] ?? EMPTY_SERVER_USER_DATA;
}

export function copyServerUserData(data: ServerScopedUserData): ServerScopedUserData {
  return {
    favoriteIds: [...data.favoriteIds],
    favoriteChannelIds: [...data.favoriteChannelIds],
    favoriteMovieIds: [...data.favoriteMovieIds],
    favoriteSeriesIds: [...data.favoriteSeriesIds],
    history: [...data.history],
    blockedContentIds: [...data.blockedContentIds],
  };
}

export function updateServerUserData(
  all: UserDataByServer,
  serverId: string,
  update: (current: ServerScopedUserData) => ServerScopedUserData,
): UserDataByServer {
  if (!serverId) return all;
  return { ...all, [serverId]: update(copyServerUserData(getServerUserData(all, serverId))) };
}

export function withoutServerUserData(all: UserDataByServer, serverId: string): UserDataByServer {
  const { [serverId]: _removed, ...remaining } = all;
  return remaining;
}

/** Legacy persisted data belongs to the active server, never to every server. */
export function migrateLegacyServerUserData(
  current: UserDataByServer | undefined,
  activeServerId: string,
  legacy: Partial<ServerScopedUserData>,
): UserDataByServer {
  if (current && Object.keys(current).length > 0) return current;
  if (!activeServerId) return current ?? {};
  return {
    [activeServerId]: {
      ...EMPTY_SERVER_USER_DATA,
      favoriteIds: legacy.favoriteIds ?? [],
      favoriteChannelIds: legacy.favoriteChannelIds ?? [],
      favoriteMovieIds: legacy.favoriteMovieIds ?? [],
      favoriteSeriesIds: legacy.favoriteSeriesIds ?? [],
      history: (legacy.history ?? []).map((item) => ({ ...item, serverId: activeServerId })),
      blockedContentIds: [],
    },
  };
}
