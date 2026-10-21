import type { BlockedCategoryIds, PlayHistory } from "./types";

export interface ServerScopedUserData {
  favoriteIds: string[];
  favoriteChannelIds: string[];
  favoriteMovieIds: string[];
  favoriteSeriesIds: string[];
  history: PlayHistory[];
  blockedContentIds: string[];
  /** Category locks are deliberately scoped to the active provider. */
  blockedCategoryIds: BlockedCategoryIds;
  /** Number of playback sessions per catalogue item for this server. */
  playCounts: Record<string, number>;
}

export type UserDataByServer = Record<string, ServerScopedUserData>;

export const EMPTY_SERVER_USER_DATA: ServerScopedUserData = {
  favoriteIds: [],
  favoriteChannelIds: [],
  favoriteMovieIds: [],
  favoriteSeriesIds: [],
  history: [],
  blockedContentIds: [],
  blockedCategoryIds: { live: [], movies: [], series: [] },
  playCounts: {},
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
    blockedCategoryIds: {
      live: [...(data.blockedCategoryIds?.live ?? [])],
      movies: [...(data.blockedCategoryIds?.movies ?? [])],
      series: [...(data.blockedCategoryIds?.series ?? [])],
    },
    playCounts: { ...(data.playCounts ?? {}) },
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
  // Add newly introduced scoped fields to existing persisted server records.
  // This keeps upgrades from producing an undefined playback ranking.
  if (current && Object.keys(current).length > 0) {
    return Object.fromEntries(
      Object.entries(current).map(([serverId, userData]) => [
        serverId,
        {
          ...EMPTY_SERVER_USER_DATA,
          ...userData,
          blockedCategoryIds: {
            live: userData.blockedCategoryIds?.live ?? [],
            movies: userData.blockedCategoryIds?.movies ?? [],
            series: userData.blockedCategoryIds?.series ?? [],
          },
          playCounts: userData.playCounts ?? {},
        },
      ]),
    );
  }
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
      blockedCategoryIds: { live: [], movies: [], series: [] },
      playCounts: legacy.playCounts ?? {},
    },
  };
}
