import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  ContentCache,
  ContentType,
  PlayHistory,
  Preferences,
  ServerProfile,
  TraktConfig,
} from './types';

export interface SyncState {
  isSyncing: boolean;
  /** The server id that was last successfully started (set at sync-start, before any await). */
  lastSyncedServerId: string | null;
  syncError: string | null;
  syncProgress: string | null;
}

export interface PiPState {
  isActive: boolean;
  streamUrl: string;
  title: string;
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
  trakt: TraktConfig;
  contentCache: ContentCache;
  syncState: SyncState;
  pip: PiPState;
  setHydrated: () => void;
  setPreference: (key: string, value: string | number | boolean | null) => void;
  addServer: (server: ServerProfile) => void;
  setActiveServer: (id: string) => void;
  removeServer: (id: string) => void;
  removeAllServers: () => void;
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
  setTrakt: (config: Partial<TraktConfig>) => void;
  setContentCache: (cache: Partial<ContentCache>) => void;
  setSyncState: (state: Partial<SyncState>) => void;
  clearContentCache: () => void;
  /** Reset lastSyncedServerId so the layout's useXtreamSync effect re-fires. */
  forceResync: () => void;
  activatePip: (streamUrl: string, title: string, type: ContentType) => void;
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
};

const INITIAL_PIP: PiPState = {
  isActive: false,
  streamUrl: '',
  title: '',
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
      trakt: {
        isConnected: false,
        username: '',
        accessToken: '',
        autoScrobble: false,
      },
      contentCache: EMPTY_CACHE,
      syncState: INITIAL_SYNC_STATE,
      pip: INITIAL_PIP,

      setHydrated: () => set({ _hasHydrated: true }),

      setPreference: (key, value) =>
        set((state) => ({ preferences: { ...state.preferences, [key]: value } })),

      addServer: (server) =>
        set((state) => ({
          servers: [...state.servers.map((item) => ({ ...item, isActive: false })), { ...server, isActive: true }],
          activeServerId: server.id,
          syncState: { ...INITIAL_SYNC_STATE },
        })),

      setActiveServer: (id) =>
        set((state) => ({
          activeServerId: id,
          servers: state.servers.map((server) => ({ ...server, isActive: server.id === id })),
          syncState: { ...INITIAL_SYNC_STATE },
        })),

      removeServer: (id) =>
        set((state) => {
          const isActive = state.activeServerId === id;
          return {
            servers: state.servers.filter((s) => s.id !== id),
            activeServerId: isActive ? '' : state.activeServerId,
            contentCache: isActive ? EMPTY_CACHE : state.contentCache,
            syncState: isActive ? INITIAL_SYNC_STATE : state.syncState,
          };
        }),

      removeAllServers: () =>
        set(() => ({
          servers: [],
          activeServerId: '',
          contentCache: EMPTY_CACHE,
          syncState: INITIAL_SYNC_STATE,
        })),

      logout: () =>
        set((state) => ({
          activeServerId: '',
          servers: state.servers.map((server) => ({ ...server, isActive: false })),
          contentCache: EMPTY_CACHE,
          syncState: INITIAL_SYNC_STATE,
        })),

      toggleFavorite: (id) =>
        set((state) => ({
          favoriteIds: state.favoriteIds.includes(id)
            ? state.favoriteIds.filter((favoriteId) => favoriteId !== id)
            : [...state.favoriteIds, id],
        })),

      toggleFavoriteChannel: (id) =>
        set((state) => ({
          favoriteChannelIds: state.favoriteChannelIds.includes(id)
            ? state.favoriteChannelIds.filter((fid) => fid !== id)
            : [...state.favoriteChannelIds, id],
        })),

      toggleFavoriteMovie: (id) =>
        set((state) => ({
          favoriteMovieIds: state.favoriteMovieIds.includes(id)
            ? state.favoriteMovieIds.filter((fid) => fid !== id)
            : [...state.favoriteMovieIds, id],
        })),

      toggleFavoriteSeries: (id) =>
        set((state) => ({
          favoriteSeriesIds: state.favoriteSeriesIds.includes(id)
            ? state.favoriteSeriesIds.filter((fid) => fid !== id)
            : [...state.favoriteSeriesIds, id],
        })),

      isFavoriteChannel: (id) => get().favoriteChannelIds.includes(id),
      isFavoriteMovie: (id) => get().favoriteMovieIds.includes(id),
      isFavoriteSeries: (id) => get().favoriteSeriesIds.includes(id),

      saveHistory: (item) =>
        set((state) => ({
          history: [
            item,
            ...state.history.filter((h) => h.contentId !== item.contentId),
          ].slice(0, 12),
        })),

      setTrakt: (config) =>
        set((state) => ({ trakt: { ...state.trakt, ...config } })),

      setContentCache: (cache) =>
        set((state) => ({ contentCache: { ...state.contentCache, ...cache } })),

      setSyncState: (partial) =>
        set((state) => ({ syncState: { ...state.syncState, ...partial } })),

      clearContentCache: () => set({ contentCache: EMPTY_CACHE }),

      forceResync: () =>
        set((state) => ({
          syncState: { ...state.syncState, lastSyncedServerId: null, syncError: null },
        })),

      activatePip: (streamUrl, title, type) =>
        set({ pip: { isActive: true, streamUrl, title, type } }),

      deactivatePip: () =>
        set({ pip: INITIAL_PIP }),
    }),
    {
      name: 'app-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        preferences: state.preferences,
        servers: state.servers,
        activeServerId: state.activeServerId,
        favoriteIds: state.favoriteIds,
        favoriteChannelIds: state.favoriteChannelIds,
        favoriteMovieIds: state.favoriteMovieIds,
        favoriteSeriesIds: state.favoriteSeriesIds,
        history: state.history,
        trakt: state.trakt,
        // Do NOT persist contentCache — it can be > 6 MB and crash AsyncStorage.
        // Do NOT persist pip — PiP is a session-only state.
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    }
  )
);
