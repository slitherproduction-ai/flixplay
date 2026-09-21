import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  ContentCache,
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

interface AppStore {
  _hasHydrated: boolean;
  preferences: Preferences;
  servers: ServerProfile[];
  activeServerId: string;
  favoriteIds: string[];
  history: PlayHistory[];
  trakt: TraktConfig;
  contentCache: ContentCache;
  syncState: SyncState;
  setHydrated: () => void;
  setPreference: (key: string, value: string | number | boolean | null) => void;
  addServer: (server: ServerProfile) => void;
  setActiveServer: (id: string) => void;
  removeServer: (id: string) => void;
  removeAllServers: () => void;
  logout: () => void;
  toggleFavorite: (id: string) => void;
  saveHistory: (item: PlayHistory) => void;
  setTrakt: (config: Partial<TraktConfig>) => void;
  setContentCache: (cache: Partial<ContentCache>) => void;
  setSyncState: (state: Partial<SyncState>) => void;
  clearContentCache: () => void;
  /** Reset lastSyncedServerId so the layout's useXtreamSync effect re-fires. */
  forceResync: () => void;
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

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      _hasHydrated: false,
      preferences: {},
      servers: [],
      activeServerId: '',
      favoriteIds: [],
      history: [],
      trakt: {
        isConnected: false,
        username: '',
        accessToken: '',
        autoScrobble: false,
      },
      contentCache: EMPTY_CACHE,
      syncState: INITIAL_SYNC_STATE,

      setHydrated: () => set({ _hasHydrated: true }),

      setPreference: (key, value) =>
        set((state) => ({ preferences: { ...state.preferences, [key]: value } })),

      addServer: (server) =>
        set((state) => ({
          servers: [...state.servers.map((item) => ({ ...item, isActive: false })), { ...server, isActive: true }],
          activeServerId: server.id,
          // Reset sync so the new server gets synced on next render
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
    }),
    {
      name: 'app-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        preferences: state.preferences,
        servers: state.servers,
        activeServerId: state.activeServerId,
        favoriteIds: state.favoriteIds,
        history: state.history,
        trakt: state.trakt,
        // Do NOT persist contentCache — it can be > 6 MB and crash AsyncStorage.
        // Channels/VOD are always re-fetched on launch.
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    }
  )
);
