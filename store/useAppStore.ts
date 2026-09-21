import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  PlayHistory,
  Preferences,
  ServerProfile,
  TraktConfig,
} from './types';

interface AppStore {
  preferences: Preferences;
  servers: ServerProfile[];
  activeServerId: string;
  favoriteIds: string[];
  history: PlayHistory[];
  trakt: TraktConfig;
  setPreference: (key: string, value: string | number | boolean | null) => void;
  addServer: (server: ServerProfile) => void;
  setActiveServer: (id: string) => void;
  toggleFavorite: (id: string) => void;
  saveHistory: (item: PlayHistory) => void;
  setTrakt: (config: Partial<TraktConfig>) => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      preferences: {},
      servers: [
        {
          id: 'demo-premium',
          name: 'Premium Plus',
          serverUrl: 'https://demo.flixplay.tv',
          username: 'demo',
          password: 'demo',
          isActive: true,
          expiryDate: '18/12/2025',
          maxConnections: 3,
          activeConnections: 1,
          format: 'HLS',
        },
      ],
      activeServerId: 'demo-premium',
      favoriteIds: ['channel-espn', 'channel-globo', 'series-dragon'],
      history: [
        {
          contentId: 'series-last-of-us',
          type: 'series',
          title: 'The Last of Us',
          subtitle: 'T1:E5 · Resistir',
          thumbnail: 'https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&w=600&q=82',
          positionMs: 2520000,
          durationMs: 3600000,
          updatedAt: '2025-09-20T22:10:00.000Z',
        },
        {
          contentId: 'movie-oppenheimer',
          type: 'movie',
          title: 'Oppenheimer',
          subtitle: 'Retomar do início do ato final',
          thumbnail: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=600&q=82',
          positionMs: 3180000,
          durationMs: 10800000,
          updatedAt: '2025-09-19T19:45:00.000Z',
        },
      ],
      trakt: {
        isConnected: true,
        username: 'marina.cinema',
        accessToken: 'demo-token',
        autoScrobble: true,
      },
      setPreference: (key, value) =>
        set((state) => ({ preferences: { ...state.preferences, [key]: value } })),
      addServer: (server) =>
        set((state) => ({
          servers: [...state.servers.map((item) => ({ ...item, isActive: false })), { ...server, isActive: true }],
          activeServerId: server.id,
        })),
      setActiveServer: (id) =>
        set((state) => ({
          activeServerId: id,
          servers: state.servers.map((server) => ({ ...server, isActive: server.id === id })),
        })),
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
      }),
    }
  )
);
