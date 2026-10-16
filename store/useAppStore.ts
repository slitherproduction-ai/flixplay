import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { secureStateStorage } from '@/services/security/secureStorage';
import { catalogDatabase } from '@/data/database/catalogDatabase';
import {
  EMPTY_SERVER_USER_DATA,
  getServerUserData,
  migrateLegacyServerUserData,
  updateServerUserData,
  withoutServerUserData,
  type UserDataByServer,
} from './serverScopedData';
import type {
  ContentCache,
  ContentType,
  EpgProgram,
  PlayHistory,
  Preferences,
  ServerProfile,
} from './types';

export interface SyncState {
  isSyncing: boolean;
  /** The server id that was last successfully started (set at sync-start, before any await). */
  lastSyncedServerId: string | null;
  syncError: string | null;
  syncProgress: string | null;
  progressPercent: number;
  stages: Record<"live" | "movies" | "series", "pending" | "running" | "complete" | "error">;
  stageErrors: Partial<Record<"live" | "movies" | "series", string>>;
}

export interface PiPState {
  isActive: boolean;
  streamUrl: string;
  title: string;
  subtitle: string;
  thumbnail: string;
  contentId: string;
  type: ContentType;
}

interface AppStore {
  _hasHydrated: boolean;
  preferences: Preferences;
  servers: ServerProfile[];
  activeServerId: string;
  /** Legacy generic favorites */
  favoriteIds: string[];
  /** Typed favorites for channels, movies, and series */
  favoriteChannelIds: string[];
  favoriteMovieIds: string[];
  favoriteSeriesIds: string[];
  history: PlayHistory[];
  blockedContentIds: string[];
  /** Active-server projection of the persistent playback ranking. */
  playCounts: Record<string, number>;
  /** Persisted per-server data. The flat fields above are active-server projections for UI compatibility. */
  userDataByServer: UserDataByServer;
  contentCache: ContentCache;
  syncState: SyncState;
  pip: PiPState;
  setHydrated: () => void;
  setHydrating: () => void;
  setPreference: (key: string, value: string | number | boolean | null) => void;
  addServer: (server: ServerProfile) => void;
  setActiveServer: (id: string) => void;
  removeServer: (id: string) => Promise<void>;
  removeAllServers: () => Promise<void>;
  logout: () => void;
  /** Legacy generic toggle (kept for compatibility) */
  toggleFavorite: (id: string) => void;
  toggleFavoriteChannel: (id: string) => void;
  toggleFavoriteMovie: (id: string) => void;
  toggleFavoriteSeries: (id: string) => void;
  isFavoriteChannel: (id: string) => boolean;
  isFavoriteMovie: (id: string) => boolean;
  isFavoriteSeries: (id: string) => boolean;
  saveHistory: (item: PlayHistory) => void;
  removeHistoryItem: (contentId: string) => void;
  clearHistory: () => void;
  recordContentPlay: (contentId: string) => void;
  toggleContentBlocked: (id: string) => void;
  isContentBlocked: (id: string) => boolean;
  setContentCache: (cache: Partial<ContentCache>) => void;
  updateChannelEpg: (channelId: string, programs: EpgProgram[]) => void;
  updateChannelEpgBatch: (updates: Array<{ channelId: string; programs: EpgProgram[] }>) => void;
  setSyncState: (state: Partial<SyncState>) => void;
  clearContentCache: () => void;
  /** Reset lastSyncedServerId so the layout's useXtreamSync effect re-fires. */
  forceResync: () => void;
  activatePip: (streamUrl: string, title: string, type: ContentType, contentId?: string, thumbnail?: string, subtitle?: string) => void;
  deactivatePip: () => void;
}

const EMPTY_CACHE: ContentCache = {
  liveCategories: [],
  liveChannels: [],
  vodCategories: [],
  vodMovies: [],
  seriesCategories: [],
  seriesList: [],
  lastSyncedAt: null,
};

const INITIAL_SYNC_STATE: SyncState = {
  isSyncing: false,
  lastSyncedServerId: null,
  syncError: null,
  syncProgress: null,
  progressPercent: 0,
  stages: { live: "pending", movies: "pending", series: "pending" },
  stageErrors: {},
};

const INITIAL_PIP: PiPState = {
  isActive: false,
  streamUrl: '',
  title: '',
  subtitle: '',
  thumbnail: '',
  contentId: '',
  type: 'live',
};

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      _hasHydrated: false,
      preferences: {},
      servers: [],
      activeServerId: '',
      favoriteIds: [],
      favoriteChannelIds: [],
      favoriteMovieIds: [],
      favoriteSeriesIds: [],
      history: [],
      blockedContentIds: [],
      playCounts: {},
      userDataByServer: {},
      contentCache: EMPTY_CACHE,
      syncState: INITIAL_SYNC_STATE,
      pip: INITIAL_PIP,

      setHydrated: () => set({ _hasHydrated: true }),
      setHydrating: () => set({ _hasHydrated: false }),

      setPreference: (key, value) =>
        set((state) => ({ preferences: { ...state.preferences, [key]: value } })),

      addServer: (server) =>
        set((state) => ({
          servers: [...state.servers.map((item) => ({ ...item, isActive: false })), { ...server, isActive: true }],
          activeServerId: server.id,
          favoriteIds: [],
          favoriteChannelIds: [],
          favoriteMovieIds: [],
          favoriteSeriesIds: [],
          history: [],
          blockedContentIds: [],
          playCounts: {},
          userDataByServer: state.userDataByServer[server.id]
            ? state.userDataByServer
            : { ...state.userDataByServer, [server.id]: EMPTY_SERVER_USER_DATA },
          contentCache: EMPTY_CACHE,
          syncState: { ...INITIAL_SYNC_STATE },
        })),

      setActiveServer: (id) =>
        set((state) => {
          const userData = getServerUserData(state.userDataByServer, id);
          return {
          activeServerId: id,
          servers: state.servers.map((server) => ({ ...server, isActive: server.id === id })),
          contentCache: EMPTY_CACHE,
          syncState: { ...INITIAL_SYNC_STATE },
          favoriteIds: userData.favoriteIds,
          favoriteChannelIds: userData.favoriteChannelIds,
          favoriteMovieIds: userData.favoriteMovieIds,
          favoriteSeriesIds: userData.favoriteSeriesIds,
          history: userData.history,
          blockedContentIds: userData.blockedContentIds,
          playCounts: userData.playCounts,
        };
        }),

      removeServer: async (id) => {
        await catalogDatabase.clearServer(id);
        set((state) => {
          const isActive = state.activeServerId === id;
          return {
            servers: state.servers.filter((s) => s.id !== id),
            activeServerId: isActive ? '' : state.activeServerId,
            contentCache: isActive ? EMPTY_CACHE : state.contentCache,
            syncState: isActive ? INITIAL_SYNC_STATE : state.syncState,
            userDataByServer: withoutServerUserData(state.userDataByServer, id),
            ...(isActive ? EMPTY_SERVER_USER_DATA : {}),
          };
        });
      },

      removeAllServers: async () => {
        await catalogDatabase.clearAll();
        set(() => ({
          servers: [],
          activeServerId: '',
          contentCache: EMPTY_CACHE,
          syncState: INITIAL_SYNC_STATE,
          favoriteIds: [],
          favoriteChannelIds: [],
          favoriteMovieIds: [],
          favoriteSeriesIds: [],
          history: [],
          blockedContentIds: [],
          playCounts: {},
          userDataByServer: {},
        }));
      },

      logout: () =>
        set((state) => ({
          activeServerId: '',
          servers: state.servers.map((server) => ({ ...server, isActive: false })),
          contentCache: EMPTY_CACHE,
          syncState: INITIAL_SYNC_STATE,
          favoriteIds: [],
          favoriteChannelIds: [],
          favoriteMovieIds: [],
          favoriteSeriesIds: [],
          history: [],
          blockedContentIds: [],
          playCounts: {},
        })),

      toggleFavorite: (id) =>
        set((state) => {
          const favoriteIds = state.favoriteIds.includes(id)
            ? state.favoriteIds.filter((favoriteId) => favoriteId !== id)
            : [...state.favoriteIds, id];
          return { favoriteIds, userDataByServer: updateServerUserData(state.userDataByServer, state.activeServerId, (data) => ({ ...data, favoriteIds })) };
        }),

      toggleFavoriteChannel: (id) =>
        set((state) => {
          const favoriteChannelIds = state.favoriteChannelIds.includes(id)
            ? state.favoriteChannelIds.filter((fid) => fid !== id)
            : [...state.favoriteChannelIds, id];
          return { favoriteChannelIds, userDataByServer: updateServerUserData(state.userDataByServer, state.activeServerId, (data) => ({ ...data, favoriteChannelIds })) };
        }),

      toggleFavoriteMovie: (id) =>
        set((state) => {
          const favoriteMovieIds = state.favoriteMovieIds.includes(id)
            ? state.favoriteMovieIds.filter((fid) => fid !== id)
            : [...state.favoriteMovieIds, id];
          return { favoriteMovieIds, userDataByServer: updateServerUserData(state.userDataByServer, state.activeServerId, (data) => ({ ...data, favoriteMovieIds })) };
        }),

      toggleFavoriteSeries: (id) =>
        set((state) => {
          const favoriteSeriesIds = state.favoriteSeriesIds.includes(id)
            ? state.favoriteSeriesIds.filter((fid) => fid !== id)
            : [...state.favoriteSeriesIds, id];
          return { favoriteSeriesIds, userDataByServer: updateServerUserData(state.userDataByServer, state.activeServerId, (data) => ({ ...data, favoriteSeriesIds })) };
        }),

      isFavoriteChannel: (id) => get().favoriteChannelIds.includes(id),
      isFavoriteMovie: (id) => get().favoriteMovieIds.includes(id),
      isFavoriteSeries: (id) => get().favoriteSeriesIds.includes(id),

      saveHistory: (item) =>
        set((state) => {
          const scopedItem = { ...item, serverId: state.activeServerId || item.serverId };
          const history = [
            scopedItem,
            ...state.history.filter((h) => h.contentId !== item.contentId),
          ].slice(0, 50);
          return { history, userDataByServer: updateServerUserData(state.userDataByServer, state.activeServerId, (data) => ({ ...data, history })) };
        }),

      removeHistoryItem: (contentId) =>
        set((state) => {
          const history = state.history.filter((h) => h.contentId !== contentId);
          return { history, userDataByServer: updateServerUserData(state.userDataByServer, state.activeServerId, (data) => ({ ...data, history })) };
        }),

      clearHistory: () => set((state) => ({ history: [], userDataByServer: updateServerUserData(state.userDataByServer, state.activeServerId, (data) => ({ ...data, history: [] })) })),

      // Persist a truthful, per-server count for each new playback session.
      // History is intentionally de-duplicated, so it cannot be used as a
      // "most watched" metric by itself.
      recordContentPlay: (contentId) => {
        if (!contentId) return;
        set((state) => {
          const playCounts = {
            ...state.playCounts,
            [contentId]: (state.playCounts[contentId] ?? 0) + 1,
          };
          return {
            playCounts,
            userDataByServer: updateServerUserData(
              state.userDataByServer,
              state.activeServerId,
              (data) => ({ ...data, playCounts }),
            ),
          };
        });
      },

      toggleContentBlocked: (id) => set((state) => {
        const blockedContentIds = state.blockedContentIds.includes(id) ? state.blockedContentIds.filter((value) => value !== id) : [...state.blockedContentIds, id];
        return { blockedContentIds, userDataByServer: updateServerUserData(state.userDataByServer, state.activeServerId, (data) => ({ ...data, blockedContentIds })) };
      }),
      isContentBlocked: (id) => get().blockedContentIds.includes(id),

      setContentCache: (cache) =>
        set((state) => ({ contentCache: { ...state.contentCache, ...cache } })),

      updateChannelEpg: (channelId, programs) =>
        set((state) => {
          const current = programs.find((program) => program.isCurrent) ?? programs[0];
          const currentIndex = current ? programs.indexOf(current) : -1;
          const next = currentIndex >= 0 ? programs[currentIndex + 1] : undefined;
          return {
            contentCache: {
              ...state.contentCache,
              liveChannels: state.contentCache.liveChannels.map((channel) =>
                channel.id === channelId
                  ? {
                      ...channel,
                      currentEpg: current ?? channel.currentEpg,
                      nextProgram: next?.title ?? "Programação não informada",
                      epgPrograms: programs,
                      epgUpdatedAt: new Date().toISOString(),
                    }
                  : channel,
              ),
            },
          };
        }),

      // EPG responses are delivered in small bursts. Updating them together
      // avoids recreating the full channel collection once for every request,
      // which is especially expensive on Fire TV devices with large lists.
      updateChannelEpgBatch: (updates) =>
        set((state) => {
          if (updates.length === 0) return state;
          const byId = new Map(updates.map((update) => [update.channelId, update.programs]));
          const updatedAt = new Date().toISOString();
          return {
            contentCache: {
              ...state.contentCache,
              liveChannels: state.contentCache.liveChannels.map((channel) => {
                const programs = byId.get(channel.id);
                if (!programs) return channel;
                const current = programs.find((program) => program.isCurrent) ?? programs[0];
                const currentIndex = current ? programs.indexOf(current) : -1;
                const next = currentIndex >= 0 ? programs[currentIndex + 1] : undefined;
                return {
                  ...channel,
                  currentEpg: current ?? channel.currentEpg,
                  nextProgram: next?.title ?? "Programação não informada",
                  epgPrograms: programs,
                  epgUpdatedAt: updatedAt,
                };
              }),
            },
          };
        }),

      setSyncState: (partial) =>
        set((state) => ({ syncState: { ...state.syncState, ...partial } })),

      clearContentCache: () => set({ contentCache: EMPTY_CACHE }),

      forceResync: () =>
        set((state) => ({
          syncState: { ...state.syncState, lastSyncedServerId: null, syncError: null },
        })),

      activatePip: (streamUrl, title, type, contentId = '', thumbnail = '', subtitle = '') =>
        set({ pip: { isActive: true, streamUrl, title, subtitle, thumbnail, contentId, type } }),

      deactivatePip: () =>
        set({ pip: INITIAL_PIP }),
    }),
    {
      name: 'app-storage',
      storage: createJSONStorage(() => secureStateStorage),
      partialize: (state) => ({
        preferences: state.preferences,
        servers: state.servers,
        activeServerId: state.activeServerId,
        favoriteIds: state.favoriteIds,
        favoriteChannelIds: state.favoriteChannelIds,
        favoriteMovieIds: state.favoriteMovieIds,
        favoriteSeriesIds: state.favoriteSeriesIds,
        history: state.history,
        blockedContentIds: state.blockedContentIds,
        playCounts: state.playCounts,
        userDataByServer: state.userDataByServer,
        // Do NOT persist contentCache — it can be > 6 MB and crash AsyncStorage.
        // Do NOT persist pip — PiP is a session-only state.
      }),
      onRehydrateStorage: () => (state, _error) => {
        // `state` is undefined when AsyncStorage or AndroidKeyStore rejects.
        // Marking hydration complete from the store closure prevents the root
        // route from spinning forever and safely sends the user to login.
        if (state) {
          const userDataByServer = migrateLegacyServerUserData(
            state.userDataByServer,
            state.activeServerId,
            state,
          );
          const activeData = getServerUserData(userDataByServer, state.activeServerId);
          state.userDataByServer = userDataByServer;
          state.favoriteIds = activeData.favoriteIds;
          state.favoriteChannelIds = activeData.favoriteChannelIds;
          state.favoriteMovieIds = activeData.favoriteMovieIds;
          state.favoriteSeriesIds = activeData.favoriteSeriesIds;
          state.history = activeData.history;
          state.blockedContentIds = activeData.blockedContentIds;
          state.playCounts = activeData.playCounts;
          state.setHydrated();
          return;
        }
        queueMicrotask(() => useAppStore.getState().setHydrated());
      },
    }
  )
);
