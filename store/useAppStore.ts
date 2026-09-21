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

interface SyncState {
  isSyncing: boolean;
  syncError: string | null;
  syncProgress: string | null;
}

interface AppStore {
  _hasHydrated: boolean;
  preferences: Preferences;
  servers: ServerProfile[];
  activeServerId: string;
  isDemoMode: boolean;
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
  setDemoMode: (enabled: boolean) => void;
  toggleFavorite: (id: string) => void;
  saveHistory: (item: PlayHistory) => void;
  setTrakt: (config: Partial<TraktConfig>) => void;
  setContentCache: (cache: Partial<ContentCache>) => void;
  setSyncState: (state: Partial<SyncState>) => void;
  clearContentCache: () => void;
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

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      _hasHydrated: false,
      preferences: {},
      servers: [],
      activeServerId: '',
      isDemoMode: false,
      favoriteIds: [],
      history: [],
      trakt: {
        isConnected: false,
        username: '',
        accessToken: '',
        autoScrobble: false,
      },
      contentCache: EMPTY_CACHE,
      syncState: {
        isSyncing: false,
        syncError: null,
        syncProgress: null,
      },
      setHydrated: () => set({ _hasHydrated: true }),
      setPreference: (key, value) =>
        set((state) => ({ preferences: { ...state.preferences, [key]: value } })),
      addServer: (server) =>
        set((state) => ({
          servers: [...state.servers.map((item) => ({ ...item, isActive: false })), { ...server, isActive: true }],
          activeServerId: server.id,
          isDemoMode: false,
        })),
      setActiveServer: (id) =>
        set((state) => ({
          activeServerId: id,
          servers: state.servers.map((server) => ({ ...server, isActive: server.id === id })),
          isDemoMode: false,
        })),
      removeServer: (id) =>
        set((state) => ({
          servers: state.servers.filter((s) => s.id !== id),
          activeServerId: state.activeServerId === id ? '' : state.activeServerId,
        })),
      removeAllServers: () =>
        set(() => ({
          servers: [],
          activeServerId: '',
          isDemoMode: false,
          contentCache: EMPTY_CACHE,
        })),
      logout: () =>
        set((state) => ({
          activeServerId: '',
          isDemoMode: false,
          servers: state.servers.map((server) => ({ ...server, isActive: false })),
          contentCache: EMPTY_CACHE,
        })),
      setDemoMode: (enabled) =>
        set({ isDemoMode: enabled }),
      toggleFavorite: (id) =>
        set((state) => ({
          favoriteIds: state.favoriteIds.includes(id)
            ? state.favoriteIds.filter((favoriteId) => favoriteId !== id)
            : [...state.favoriteIds, id],
        })),
      saveHistory: (item) =>
        set((state) => ({
          history: [item, ...state.history.filter((historyItem) => historyItem.contentId !== item.contentId)].slice(0, 12),
        })),
      setTrakt: (config) => set((state) => ({ trakt: { ...state.trakt, ...config } })),
      setContentCache: (cache) =>
        set((state) => ({ contentCache: { ...state.contentCache, ...cache } })),
      setSyncState: (state) =>
        set((prev) => ({ syncState: { ...prev.syncState, ...state } })),
      clearContentCache: () =>
        set({ contentCache: EMPTY_CACHE }),
    }),
    {
      name: 'app-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        preferences: state.preferences,
        servers: state.servers,
        activeServerId: state.activeServerId,
        isDemoMode: state.isDemoMode,
        favoriteIds: state.favoriteIds,
        history: state.history,
        trakt: state.trakt,
        contentCache: state.contentCache,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    }
  )
);
